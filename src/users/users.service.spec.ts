import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

// Mock generatePseudonym
jest.mock('../common/utils', () => ({
  generatePseudonym: jest.fn().mockReturnValue('mocked-pseudonym'),
}));

const mockPrismaService = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: Prisma.UserCreateInput = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
      role: Role.STUDENT,
      username: 'testuser',
    };

    it('should create a user with provided username', async () => {
      prisma.user.create.mockResolvedValue(createUserDto);

      const result = await service.create(createUserDto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: createUserDto,
      });
      expect(result).toEqual(createUserDto);
    });

    it('should generate a username if not provided', async () => {
        const dtoWithoutUsername = { ...createUserDto };
        delete dtoWithoutUsername.username;
        
        prisma.user.findUnique.mockResolvedValue(null); // Username available
        prisma.user.create.mockImplementation((args) => Promise.resolve(args.data));

        const result = await service.create(dtoWithoutUsername);

        expect(prisma.user.findUnique).toHaveBeenCalled();
        expect(result.username).toBe('mocked-pseudonym');
    });

    it('should retry generating username if taken', async () => {
        const dtoWithoutUsername = { ...createUserDto };
        delete dtoWithoutUsername.username;

        // First attempt collides, second succeeds
        prisma.user.findUnique
            .mockResolvedValueOnce({ id: 'existing' } as any)
            .mockResolvedValueOnce(null);
            
        prisma.user.create.mockImplementation((args) => Promise.resolve(args.data));

        await service.create(dtoWithoutUsername);

        expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException if username generation fails after retries', async () => {
        const dtoWithoutUsername = { ...createUserDto };
        delete dtoWithoutUsername.username;

        // Always collides
        prisma.user.findUnique.mockResolvedValue({ id: 'existing' } as any);

        await expect(service.create(dtoWithoutUsername)).rejects.toThrow(ConflictException);
        expect(prisma.user.findUnique).toHaveBeenCalledTimes(5);
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      const user = { id: '1', email: 'test@test.com' };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne({ id: '1' });
      expect(result).toEqual(user);
    });

    it('should return null if user is soft deleted', async () => {
      const user = { id: '1', deletedAt: new Date() };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne({ id: '1' });
      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.findOne({ id: '1' });
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const params = {
        where: { id: '1' },
        data: { email: 'new@test.com' },
      };
      const updatedUser = { id: '1', email: 'new@test.com' };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(params);
      expect(prisma.user.update).toHaveBeenCalledWith(params);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('remove', () => {
    it('should soft delete a user', async () => {
      const userId = '1';
      prisma.user.update.mockResolvedValue({ id: userId, deletedAt: new Date() });

      await service.remove(userId);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('isEmailTaken', () => {
    it('should return true if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' });
      const result = await service.isEmailTaken('test@test.com');
      expect(result).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.isEmailTaken('test@test.com');
      expect(result).toBe(false);
    });
  });
});
