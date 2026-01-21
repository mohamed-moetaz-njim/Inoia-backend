import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCommentDto,
  CreatePostDto,
  PaginationQueryDto,
  UpdatePostDto,
  UpdateCommentDto,
} from './dto/forum.dto';
import { ensureOwnership } from '../common/utils/authorization.utils';
import { Role } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ForumService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private usersService: UsersService,
  ) {}

  private getAuthorSelect() {
    return {
      id: true,
      username: true,
      role: true,
      deletedAt: true,
      therapistVerification: {
        select: {
          certificationReference: true,
        },
      },
    };
  }

  private mapAuthor(author: any) {
    // Expose therapistProfile only for therapist authors
    const isTherapist = author.role === Role.THERAPIST;
    return {
      username: author.username,
      role: author.role,
      therapistProfile:
        isTherapist && author.therapistVerification
          ? {
              certificationReference:
                author.therapistVerification.certificationReference,
            }
          : undefined,
    };
  }

  async findAllPosts(query: PaginationQueryDto, currentUserId?: string) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          deletedAt: null,
          author: {
            deletedAt: null,
          },
        },
        include: {
          author: {
            select: this.getAuthorSelect(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.post.count({
        where: {
          deletedAt: null,
          author: {
            deletedAt: null,
          },
        },
      }),
    ]);

    // Compute voteCount and current user's vote per post
    const postIds = posts.map((p) => p.id);

    const voteAggregates = await this.prisma.vote.groupBy({
      by: ['postId'],
      _sum: {
        value: true,
      },
      where: {
        postId: { in: postIds },
      },
    });

    const voteMap = new Map<string, number>();
    voteAggregates.forEach((agg) => {
      if (agg.postId) {
        voteMap.set(agg.postId, agg._sum.value || 0);
      }
    });

    const userVoteMap = new Map<string, number>();
    if (currentUserId && postIds.length > 0) {
      const userVotes = await this.prisma.vote.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: {
          postId: true,
          value: true,
        },
      });
      userVotes.forEach((v) => {
        if (v.postId) {
          userVoteMap.set(v.postId, v.value);
        }
      });
    }

    return {
      data: posts.map((post) => {
        const author = post.author as unknown as {
          username: string;
          role: Role;
          therapistVerification: { certificationReference: string } | null;
        };

        const voteCount = voteMap.get(post.id) || 0;
        const userVote = userVoteMap.get(post.id) || 0;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Exclude included author from post payload
        const { author: _, ...restPost } = post;

        const result: any = {
          ...restPost,
          voteCount,
          userVote,
          author: {
            username: author.username,
            role: author.role,
          },
        };

        if (author.role === Role.THERAPIST && author.therapistVerification) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- result is intentionally built as any
          result.author.therapistProfile = {
            certificationReference:
              author.therapistVerification.certificationReference,
          };
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- result is intentionally built as any
        return result;
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOnePost(id: string, currentUserId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: this.getAuthorSelect(),
        },
        votes: {
          select: { userId: true, value: true },
        },
      },
    });

    if (!post) throw new NotFoundException('Post not found');

    if (post.author.deletedAt) throw new NotFoundException('Post not found');

    if (post.deletedAt) {
      if (!currentUserId || post.author.id !== currentUserId) {
        throw new NotFoundException('Post not found');
      }
    }

    const { author, votes, ...postData } = post;

    const voteCount = votes.reduce((sum, v) => sum + v.value, 0);
    const userVote = currentUserId
      ? votes.find((v) => v.userId === currentUserId)?.value || 0
      : 0;

    return {
      ...postData,
      voteCount,
      userVote,
      author: this.mapAuthor(author),
    };
  }

  async findComments(
    postId: string,
    query: PaginationQueryDto,
    currentUserId?: string,
  ) {
    await this.findOnePost(postId, currentUserId);

    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: {
          postId,
          author: { deletedAt: null },
          OR: [
            { deletedAt: null },
            { authorId: currentUserId ?? 'no_match_id' },
          ],
        },
        include: {
          author: {
            select: this.getAuthorSelect(),
          },
          votes: {
            select: { userId: true, value: true },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({
        where: {
          postId,
          author: { deletedAt: null },
          OR: [
            { deletedAt: null },
            { authorId: currentUserId ?? 'no_match_id' },
          ],
        },
      }),
    ]);

    return {
      data: comments.map((comment) => {
        const { author, votes, ...commentData } = comment;

        const voteCount = votes.reduce((sum, v) => sum + v.value, 0);
        const userVote = currentUserId
          ? votes.find((v) => v.userId === currentUserId)?.value || 0
          : 0;

        return {
          ...commentData,
          voteCount,
          userVote,
          author: this.mapAuthor(author),
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createPost(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        title: dto.title,
        content: dto.content,
      },
      include: {
        author: {
          select: this.getAuthorSelect(),
        },
      },
    });

    const { author, ...postData } = post;
    return {
      ...postData,
      author: this.mapAuthor(author),
    };
  }

  async updatePost(userId: string, postId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    if (post.deletedAt) throw new NotFoundException('Post not found');

    ensureOwnership(post.authorId, userId);

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content,
      },
      include: {
        author: {
          select: this.getAuthorSelect(),
        },
      },
    });

    const { author, ...postData } = updated;
    return {
      ...postData,
      author: this.mapAuthor(author),
    };
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.deletedAt) throw new NotFoundException('Post not found');

    ensureOwnership(post.authorId, userId);

    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  }

  async createComment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        content: dto.content,
      },
      include: {
        author: {
          select: this.getAuthorSelect(),
        },
      },
    });

    const { author, ...commentData } = comment;

    const commentAuthorUsername = author.username;

    if (post.authorId !== userId) {
      const content = `@${commentAuthorUsername} commented on your post '${post.title}'`;
      await this.notificationService.createNotification(post.authorId, content);
    }

    const mentions = dto.content.match(/@([a-zA-Z0-9_]+)/g);
    if (mentions) {
      const uniqueMentions = [...new Set(mentions)];

      for (const mention of uniqueMentions) {
        const username = mention.substring(1);

        const user = await this.usersService.findOne({ username });
        // Do not notify the commenter for self-mentions
        if (user && user.id !== userId) {
          const content = `@${commentAuthorUsername} mentioned you in a comment`;
          await this.notificationService.createNotification(user.id, content);
        }
      }
    }

    return {
      ...commentData,
      author: this.mapAuthor(author),
    };
  }

  async updateComment(userId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.deletedAt) throw new NotFoundException('Comment not found');

    ensureOwnership(comment.authorId, userId);

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
      },
      include: {
        author: {
          select: this.getAuthorSelect(),
        },
      },
    });

    const { author, ...commentData } = updated;
    return {
      ...commentData,
      author: this.mapAuthor(author),
    };
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.deletedAt) throw new NotFoundException('Comment not found');

    ensureOwnership(comment.authorId, userId);

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }
}
