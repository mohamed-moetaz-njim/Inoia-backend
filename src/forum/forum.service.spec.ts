import { Test, TestingModule } from '@nestjs/testing';
import { ForumService } from './forum.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { UsersService } from '../users/users.service';
import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

const mockPrismaService = {
  post: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  comment: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  vote: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockNotificationService = {
  createNotification: jest.fn(),
};

const mockUsersService = {
  findOne: jest.fn(),
};

describe('ForumService', () => {
  let service: ForumService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<ForumService>(ForumService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockAuthor = {
    id: 'user1',
    username: 'author',
    role: Role.STUDENT,
    deletedAt: null,
    therapistVerification: null,
  };

  const mockPost = {
    id: 'post1',
    title: 'Test Post',
    content: 'Content',
    authorId: 'user1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    author: mockAuthor,
    votes: [], // Added votes array
  };

  describe('findAllPosts', () => {
    it('should return paginated posts', async () => {
      prisma.post.findMany.mockResolvedValue([mockPost]);
      prisma.post.count.mockResolvedValue(1);
      prisma.vote.groupBy.mockResolvedValue([
        { postId: 'post1', _sum: { value: 10 } },
      ]);
      prisma.vote.findMany.mockResolvedValue([]);

      const result = await service.findAllPosts({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].author).toEqual({
        username: 'author',
        role: Role.STUDENT,
        therapistProfile: undefined,
      });
      expect(result.data[0].voteCount).toBe(10);
    });
  });

  describe('findOnePost', () => {
    it('should return a post if found', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);

      const result = await service.findOnePost('post1');
      expect(result.id).toBe('post1');
      expect(result.voteCount).toBe(0);
    });

    it('should throw NotFoundException if post not found', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      await expect(service.findOnePost('post1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if author is deleted', async () => {
      prisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        author: { ...mockAuthor, deletedAt: new Date() },
      });
      await expect(service.findOnePost('post1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if post is deleted and user is not owner', async () => {
      prisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
      });
      await expect(service.findOnePost('post1', 'user2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return deleted post if user is owner', async () => {
      prisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
      });
      const result = await service.findOnePost('post1', 'user1');
      expect(result.id).toBe('post1');
    });
  });

  describe('createPost', () => {
    it('should create a post', async () => {
      prisma.post.create.mockResolvedValue(mockPost);

      const result = await service.createPost('user1', {
        title: 'T',
        content: 'C',
      });

      expect(prisma.post.create).toHaveBeenCalledWith({
        data: {
          authorId: 'user1',
          title: 'T',
          content: 'C',
        },
        include: expect.any(Object),
      });
      expect(result.id).toBe('post1');
    });
  });

  describe('updatePost', () => {
    it('should update post if user is owner', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.post.update.mockResolvedValue({ ...mockPost, content: 'Updated' });

      const result = await service.updatePost('user1', 'post1', {
        content: 'Updated',
      });

      expect(result.content).toBe('Updated');
    });

    it('should throw NotFoundException if post deleted', async () => {
      prisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
      });
      await expect(
        service.updatePost('user1', 'post1', { content: 'U' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user not owner', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      await expect(
        service.updatePost('user2', 'post1', { content: 'U' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePost', () => {
    it('should soft delete post if user is owner', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);

      await service.deletePost('user1', 'post1');

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if user not owner', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      await expect(service.deletePost('user2', 'post1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createComment', () => {
    it('should create comment', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.comment.create.mockResolvedValue({
        id: 'c1',
        author: mockAuthor,
        content: 'comment',
      });

      await service.createComment('user1', 'post1', { content: 'comment' });

      expect(prisma.comment.create).toHaveBeenCalled();
    });

    it('should notify author on comment', async () => {
      prisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        authorId: 'other_user',
      });
      prisma.comment.create.mockResolvedValue({
        id: 'c1',
        author: mockAuthor,
        content: 'comment',
      });

      await service.createComment('user1', 'post1', { content: 'comment' });

      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException if post not found', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      await expect(
        service.createComment('u', 'p', { content: 'c' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteComment', () => {
    it('should soft delete comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        authorId: 'user1',
        deletedAt: null,
      });

      await service.deleteComment('user1', 'c1');

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('findComments', () => {
    it('should return comments', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.comment.findMany.mockResolvedValue([
        {
          id: 'c1',
          author: mockAuthor,
          content: 'c',
          votes: [], // Added votes array
        },
      ]);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.findComments('post1', {});
      expect(result.data).toHaveLength(1);
      expect(result.data[0].voteCount).toBe(0);
    });
  });
});
