import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoteDto } from './dto/create-vote.dto';

@Injectable()
export class VoteService {
  constructor(private prisma: PrismaService) {}

  async vote(userId: string, dto: CreateVoteDto) {
    const { postId, commentId, value } = dto;

    if ((!postId && !commentId) || (postId && commentId)) {
      throw new BadRequestException(
        'Provide exactly one of postId or commentId',
      );
    }

    let targetAuthorId: string;
    let targetDeletedAt: Date | null;

    if (postId) {
      const post = await this.prisma.post.findUnique({ where: { id: postId } });
      if (!post) throw new NotFoundException('Post not found');
      targetAuthorId = post.authorId;
      targetDeletedAt = post.deletedAt;
    } else {
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
      });
      if (!comment) throw new NotFoundException('Comment not found');
      targetAuthorId = comment.authorId;
      targetDeletedAt = comment.deletedAt;
    }

    if (targetDeletedAt) {
      throw new NotFoundException('Cannot vote on deleted content');
    }

    if (targetAuthorId === userId) {
      throw new ForbiddenException('Cannot vote on your own content');
    }

    const existingVote = await this.prisma.vote.findFirst({
      where: {
        userId,
        postId: postId || null,
        commentId: commentId || null,
      },
    });

    if (existingVote) {
      if (existingVote.value === value) {
        // Toggle off (delete)
        await this.prisma.vote.delete({ where: { id: existingVote.id } });
        return { status: 'unvoted', value: 0 };
      } else {
        // Update value
        const updated = await this.prisma.vote.update({
          where: { id: existingVote.id },
          data: { value },
        });
        return { status: 'updated', value: updated.value };
      }
    } else {
      // Create new vote
      const newVote = await this.prisma.vote.create({
        data: {
          userId,
          postId: postId || undefined,
          commentId: commentId || undefined,
          value,
        },
      });
      return { status: 'voted', value: newVote.value };
    }
  }

  async getPostVote(userId: string, postId: string) {
    const vote = await this.prisma.vote.findFirst({
      where: { userId, postId },
    });
    return { value: vote ? vote.value : 0 };
  }

  async getCommentVote(userId: string, commentId: string) {
    const vote = await this.prisma.vote.findFirst({
      where: { userId, commentId },
    });
    return { value: vote ? vote.value : 0 };
  }
}
