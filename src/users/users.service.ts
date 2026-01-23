import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, Role, VerificationStatus } from '@prisma/client';
import { generatePseudonym } from '../common/utils';

export const safeUserSelect = {
  id: true,
  email: true,
  username: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  isBanned: true,
  usernameLocked: true,
  deletedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (user && user.deletedAt) return null;
    return user;
  }

  async getPublicProfile(username: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      include: {
        therapistVerification: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isVerifiedTherapist =
      user.role === Role.THERAPIST &&
      user.therapistVerification?.status === VerificationStatus.APPROVED;

    const baseProfile = {
      username: user.username,
      role: user.role,
      roleBadge: isVerifiedTherapist ? 'Licensed Therapist' : 'Member',
      joinedDate: user.createdAt.toISOString().split('T')[0], // YYYY-MM-DD
    };

    if (!isVerifiedTherapist) {
      return baseProfile;
    }

    // Fetch extra data for therapists
    const [recentPosts, recentComments] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          authorId: user.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      }),
      this.prisma.comment.findMany({
        where: {
          authorId: user.id,
          deletedAt: null,
          post: {
            deletedAt: null,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          content: true,
          createdAt: true,
          postId: true,
          post: {
            select: {
              title: true,
            },
          },
        },
      }),
    ]);

    return {
      ...baseProfile,
      profession: user.profession,
      workplace: user.workplace,
      bio: user.bio,
      verificationBadge: 'Verified Therapist',
      recentPosts: recentPosts.map((p) => ({
        id: p.id,
        title: p.title,
        createdAt: p.createdAt,
      })),
      recentComments: recentComments.map((c) => ({
        id: c.id,
        postId: c.postId,
        postTitle: c.post.title,
        excerpt: c.content.substring(0, 100) + (c.content.length > 100 ? '...' : ''),
        createdAt: c.createdAt,
      })),
    };
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    // Generate unique username
    let username = data.username;
    if (!username) {
      // Retry logic for unique username
      let retries = 5;
      while (retries > 0) {
        const candidate = generatePseudonym();
        const exists = await this.prisma.user.findUnique({
          where: { username: candidate },
        });
        if (!exists) {
          username = candidate;
          break;
        }
        retries--;
      }
      if (!username)
        throw new ConflictException('Could not generate unique username');
    }

    return this.prisma.user.create({
      data: {
        ...data,
        username,
      },
    });
  }

  async createInTx(tx: Prisma.TransactionClient, data: Prisma.UserCreateInput): Promise<User> {
    // Generate unique username
    let username = data.username;
    if (!username) {
      // Retry logic for unique username
      let retries = 5;
      while (retries > 0) {
        const candidate = generatePseudonym();
        const exists = await tx.user.findUnique({
          where: { username: candidate },
        });
        if (!exists) {
          username = candidate;
          break;
        }
        retries--;
      }
      if (!username)
        throw new ConflictException('Could not generate unique username');
    }

    return tx.user.create({
      data: {
        ...data,
        username,
      },
    });
  }

  async findOne(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where });
    if (user && user.deletedAt) return null; // Soft delete check
    return user;
  }

  // Find user including soft-deleted ones (e.g. for admin usage)
  async findOneIncludeDeleted(
    where: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({ where });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }) {
    const { skip, take, cursor, where, orderBy } = params;
    const users = await this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        isBanned: true,
        _count: {
          select: { posts: true },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      status: user.isBanned ? 'Banned' : 'Active',
      postCount: user._count.posts,
    }));
  }

  async update(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({
      data,
      where,
    });
  }

  async remove(id: string): Promise<User> {
    // Soft delete
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return !!user;
  }
}
