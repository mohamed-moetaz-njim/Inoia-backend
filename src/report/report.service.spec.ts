import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';

const mockPrismaService = {
  post: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  comment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  report: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  adminAction: {
    create: jest.fn(),
  },
  $transaction: jest.fn((cb) => cb(mockPrismaService)),
};

describe('ReportService', () => {
  let service: ReportService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReport', () => {
    it('should create a report successfully for a post', async () => {
      const dto = { reason: 'Spam', postId: 'post-id' };
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 'post-id',
        authorId: 'other-user',
      });
      mockPrismaService.report.findFirst.mockResolvedValue(null);
      mockPrismaService.report.create.mockResolvedValue({
        id: 'report-id',
        ...dto,
        status: ReportStatus.PENDING,
      });

      const result = await service.createReport('user-id', dto);
      expect(result).toEqual({
        message: 'Report submitted successfully',
        reportId: 'report-id',
      });
      expect(mockPrismaService.report.create).toHaveBeenCalled();
    });

    it('should prevent self-reporting', async () => {
      const dto = { reason: 'Spam', postId: 'post-id' };
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 'post-id',
        authorId: 'user-id',
      });

      await expect(service.createReport('user-id', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent duplicate pending reports', async () => {
      const dto = { reason: 'Spam', postId: 'post-id' };
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 'post-id',
        authorId: 'other-user',
      });
      mockPrismaService.report.findFirst.mockResolvedValue({
        id: 'existing-report',
      });

      await expect(service.createReport('user-id', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if neither postId nor commentId provided', async () => {
      const dto = { reason: 'Spam' };
      await expect(service.createReport('user-id', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should update status and create admin action', async () => {
      const reportId = 'report-id';
      const dto = { status: ReportStatus.RESOLVED };
      const adminId = 'admin-id';

      mockPrismaService.report.findUnique.mockResolvedValue({
        id: reportId,
        postId: 'post-id',
        post: { authorId: 'author-id' },
      });
      mockPrismaService.report.update.mockResolvedValue({
        id: reportId,
        status: ReportStatus.RESOLVED,
      });

      await service.update(reportId, dto, adminId);

      expect(mockPrismaService.report.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: reportId },
          data: expect.objectContaining({ status: ReportStatus.RESOLVED }),
        }),
      );
      expect(mockPrismaService.adminAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId,
            actionType: 'REPORT_RESOLVED',
            targetPostId: 'post-id',
          }),
        }),
      );
    });

    it('should delete content if requested', async () => {
      const reportId = 'report-id';
      const dto = { status: ReportStatus.RESOLVED, deleteContent: true };
      const adminId = 'admin-id';

      mockPrismaService.report.findUnique.mockResolvedValue({
        id: reportId,
        postId: 'post-id',
        post: { authorId: 'author-id' },
      });

      await service.update(reportId, dto, adminId);

      expect(mockPrismaService.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-id' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
      expect(mockPrismaService.adminAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actionType: 'CONTENT_REMOVED' }),
        }),
      );
    });
  });
});
