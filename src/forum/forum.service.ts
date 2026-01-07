import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, CreatePostDto, PaginationQueryDto, UpdatePostDto } from './dto/forum.dto';
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
    // Constraint: Only THERAPIST authors may expose public profile fields
    const isTherapist = author.role === Role.THERAPIST;
    return {
      username: author.username,
      role: author.role,
      therapistProfile: isTherapist && author.therapistVerification ? {
        certificationReference: author.therapistVerification.certificationReference,
      } : undefined,
    };
  }

  async findAllPosts(query: PaginationQueryDto) {
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

    return {
      data: posts.map(post => {
        const { author, ...postData } = post;
        // Clean up internal author fields
        const { id, deletedAt, therapistVerification, ...restAuthor } = author;
        return {
          ...postData,
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

  async findOnePost(id: string, currentUserId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: this.getAuthorSelect(),
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

    const { author, ...postData } = post;
    const { id: authorId, deletedAt, therapistVerification, ...restAuthor } = author;

    return {
      ...postData,
      author: this.mapAuthor(author),
    };
  }

  async findComments(postId: string, query: PaginationQueryDto, currentUserId?: string) {
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
                { authorId: currentUserId ?? 'no_match_id' }
            ]
        },
        include: {
          author: {
            select: this.getAuthorSelect(),
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
                { authorId: currentUserId ?? 'no_match_id' }
            ]
        },
      }),
    ]);

    return {
      data: comments.map(comment => {
        const { author, ...commentData } = comment;
        const { id, deletedAt, therapistVerification, ...restAuthor } = author;
        return {
          ...commentData,
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

  // --- Write Operations ---

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
    
    // Check if deleted
    if (post.deletedAt) throw new NotFoundException('Post not found'); // Cannot edit deleted posts

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
    // Ensure post exists and is not deleted
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

    // --- Notifications Logic ---
    const commentAuthorUsername = author.username;

    // 1. Notify Post Author
    if (post.authorId !== userId) {
      const content = `@${commentAuthorUsername} commented on your post '${post.title}'`;
      await this.notificationService.createNotification(post.authorId, content);
    }

    // 2. Notify Mentions
    const mentions = dto.content.match(/@([a-zA-Z0-9_]+)/g);
    if (mentions) {
      const uniqueMentions = [...new Set(mentions)]; // Remove duplicates
      
      for (const mention of uniqueMentions) {
        const username = mention.substring(1); // Remove @
        
        // Skip self-mention (though unlikely to find self by username if not checked, but good to be safe)
        // Also skip if the mentioned user is the one commenting (handled by user.id !== userId check below)
        
        const user = await this.usersService.findOne({ username });
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

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.deletedAt) throw new NotFoundException('Comment not found');

    ensureOwnership(comment.authorId, userId);

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }
}
