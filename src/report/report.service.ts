import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportStatus, Prisma } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async createReport(userId: string, dto: CreateReportDto) {
    const { postId, commentId, reason } = dto;

    // Validation: Exactly one of postId or commentId
    if ((postId && commentId) || (!postId && !commentId)) {
      throw new BadRequestException(
        'Exactly one of postId or commentId must be provided',
      );
    }

    let targetAuthorId: string;

    // Check existence and get author
    if (postId) {
      const post = await this.prisma.post.findUnique({ where: { id: postId } });
      if (!post) throw new NotFoundException('Post not found');
      targetAuthorId = post.authorId;
    } else {
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
      });
      if (!comment) throw new NotFoundException('Comment not found');
      targetAuthorId = comment.authorId;
    }

    // Prevent self-reporting
    if (targetAuthorId === userId) {
      throw new BadRequestException('You cannot report your own content');
    }

    // Prevent duplicate pending reports
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId: userId,
        status: ReportStatus.PENDING,
        OR: [
          { postId: postId || undefined },
          { commentId: commentId || undefined },
        ],
      },
    });

    if (existingReport) {
      throw new BadRequestException(
        'You already have a pending report for this item',
      );
    }

    // Create report
    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        postId,
        commentId,
        reason,
        status: ReportStatus.PENDING,
      },
    });

    return { message: 'Report submitted successfully', reportId: report.id };
  }

  async findAll(page: number = 1, limit: number = 50, status?: ReportStatus) {
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = status ? { status } : {};

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: { id: true, username: true },
          },
          post: {
            select: {
              id: true,
              title: true,
              content: true,
              author: { select: { id: true, username: true } },
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
              author: { select: { id: true, username: true } },
            },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, dto: UpdateReportDto, adminId: string) {
    const { status, actionNote, deleteContent } = dto;

    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { post: true, comment: true },
    });

    if (!report) throw new NotFoundException('Report not found');

    return this.prisma.$transaction(async (tx) => {
      // Update report status
      const updatedReport = await tx.report.update({
        where: { id },
        data: {
          status,
          resolvedByAdminId: adminId,
          resolvedAt: new Date(),
        },
      });

      // Handle content deletion if resolved and requested
      if (status === ReportStatus.RESOLVED && deleteContent) {
        if (report.postId) {
          await tx.post.update({
            where: { id: report.postId },
            data: { deletedAt: new Date() },
          });
        } else if (report.commentId) {
          await tx.comment.update({
            where: { id: report.commentId },
            data: { deletedAt: new Date() },
          });
        }
      }

      // Create AdminAction log
      let actionType = 'REPORT_UPDATED';
      if (status === ReportStatus.RESOLVED) actionType = 'REPORT_RESOLVED';
      if (status === ReportStatus.DISMISSED) actionType = 'REPORT_DISMISSED';

      // Prioritize content removal action type if content is deleted
      if (status === ReportStatus.RESOLVED && deleteContent) {
        actionType = 'CONTENT_REMOVED';
      }

      const targetUserId = report.post
        ? report.post.authorId
        : report.comment
          ? report.comment.authorId
          : null;

      await tx.adminAction.create({
        data: {
          adminId,
          actionType,
          targetPostId: report.postId,
          targetCommentId: report.commentId,
          targetUserId,
          details: actionNote,
        },
      });

      return updatedReport;
    });
  }
}
