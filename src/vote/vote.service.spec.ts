import { Test, TestingModule } from '@nestjs/testing';
import { VoteService } from './vote.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

const mockPrismaService = {
  post: {
    findUnique: jest.fn(),
  },
  comment: {
    findUnique: jest.fn(),
  },
  vote: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('VoteService', () => {
  let service: VoteService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<VoteService>(VoteService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('vote', () => {
    it('should throw BadRequestException if both postId and commentId are missing', async () => {
      await expect(service.vote('user1', { value: 1 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if both postId and commentId are provided', async () => {
      await expect(
        service.vote('user1', { postId: '1', commentId: '1', value: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if post not found', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);
      await expect(
        service.vote('user1', { postId: '1', value: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user votes on own post', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: '1',
        authorId: 'user1',
      });
      await expect(
        service.vote('user1', { postId: '1', value: 1 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a new vote if none exists', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: '1',
        authorId: 'other',
      });
      mockPrismaService.vote.findFirst.mockResolvedValue(null);
      mockPrismaService.vote.create.mockResolvedValue({ value: 1 });

      const result = await service.vote('user1', { postId: '1', value: 1 });
      expect(result).toEqual({ status: 'voted', value: 1 });
      expect(mockPrismaService.vote.create).toHaveBeenCalled();
    });

    it('should toggle vote off if same value exists', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: '1',
        authorId: 'other',
      });
      mockPrismaService.vote.findFirst.mockResolvedValue({
        id: 'v1',
        value: 1,
      });

      const result = await service.vote('user1', { postId: '1', value: 1 });
      expect(result).toEqual({ status: 'unvoted', value: 0 });
      expect(mockPrismaService.vote.delete).toHaveBeenCalled();
    });

    it('should update vote if different value exists', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: '1',
        authorId: 'other',
      });
      mockPrismaService.vote.findFirst.mockResolvedValue({
        id: 'v1',
        value: 1,
      });
      mockPrismaService.vote.update.mockResolvedValue({ value: -1 });

      const result = await service.vote('user1', { postId: '1', value: -1 });
      expect(result).toEqual({ status: 'updated', value: -1 });
      expect(mockPrismaService.vote.update).toHaveBeenCalled();
    });
  });
});
