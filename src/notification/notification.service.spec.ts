import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrismaService = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const userId = 'user1';
      const content = 'Test notification';
      prisma.notification.create.mockResolvedValue({ id: '1', userId, content });

      const result = await service.createNotification(userId, content);
      expect(result).toEqual({ id: '1', userId, content });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: { userId, content },
      });
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications', async () => {
      const userId = 'user1';
      const notifications = [{ id: '1', userId, content: 'Test' }];
      prisma.notification.findMany.mockResolvedValue(notifications);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.getUserNotifications(userId, { page: 1, limit: 10 });
      expect(result.data).toEqual(notifications);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const userId = 'user1';
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId);
      expect(result).toEqual({ unreadCount: 5 });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId, readAt: null },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const userId = 'user1';
      const notificationId = 'notif1';
      prisma.notification.findUnique.mockResolvedValue({ id: notificationId, userId });
      prisma.notification.update.mockResolvedValue({ id: notificationId, userId, readAt: new Date() });

      await service.markAsRead(notificationId, userId);
      expect(prisma.notification.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user does not own notification', async () => {
      const userId = 'user1';
      const notificationId = 'notif1';
      prisma.notification.findUnique.mockResolvedValue({ id: notificationId, userId: 'otherUser' });

      await expect(service.markAsRead(notificationId, userId)).rejects.toThrow(ForbiddenException);
    });
  });
});
