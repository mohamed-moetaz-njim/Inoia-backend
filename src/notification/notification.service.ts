import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async createNotification(userId: string, content: string) {
    return this.prisma.notification.create({
      data: {
        userId,
        content,
      },
    });
  }

  async getUserNotifications(userId: string, query: NotificationQueryDto) {
    const { page = 1, limit = 10, unreadOnly } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) {
      where.readAt = null;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
    return { unreadCount: count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only mark your own notifications');
    }

    if (notification.readAt) return notification;

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { count: result.count };
  }
}
