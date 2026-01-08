import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import { generatePseudonym } from '../common/utils';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  async findOne(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where });
    if (user && user.deletedAt) return null; // Soft delete check
    return user;
  }

  // For internal use where we might want to see deleted users (e.g. admin)
  async findOneIncludeDeleted(
    where: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({ where });
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
