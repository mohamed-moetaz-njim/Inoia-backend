import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async banUser(adminId: string, targetUserId: string, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { isBanned: true },
      });

      await tx.adminAction.create({
        data: {
          adminId,
          actionType: 'BAN_USER',
          targetUserId,
          details: reason ? JSON.stringify({ reason }) : undefined,
        },
      });

      return { message: 'User banned' };
    });
  }

  async unbanUser(adminId: string, targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { isBanned: false },
      });

      await tx.adminAction.create({
        data: {
          adminId,
          actionType: 'UNBAN_USER',
          targetUserId,
        },
      });

      return { message: 'User unbanned' };
    });
  }
}
