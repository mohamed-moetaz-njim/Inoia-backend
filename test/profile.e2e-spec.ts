import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Global, Module } from '@nestjs/common';
import request from 'supertest';
import { UsersModule } from './../src/users/users.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role, VerificationStatus } from '@prisma/client';

// Mock Prisma
const mockPrismaService = {
  user: {
    findFirst: jest.fn(),
  },
  post: {
    findMany: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
  },
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: mockPrismaService }],
  exports: [PrismaService],
})
class MockPrismaModule {}

describe('ProfileController (e2e)', () => {
  let app: INestApplication;
  let prismaService: typeof mockPrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UsersModule],
    })
    .overrideProvider(PrismaService)
    .useValue(mockPrismaService)
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    
    // Unsafe cast to mock type for intellisense
    prismaService = moduleFixture.get<PrismaService>(PrismaService) as any;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /profile/:username', () => {
    it('should return 404 if user not found', () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      return request(app.getHttpServer())
        .get('/profile/nonexistent')
        .expect(404);
    });

    it('should return basic profile for student', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: '1',
        username: 'student1',
        role: Role.STUDENT,
        createdAt: new Date('2025-01-01'),
        therapistVerification: null,
      });

      const res = await request(app.getHttpServer())
        .get('/profile/student1')
        .expect(200);

      expect(res.body).toEqual({
        username: 'student1',
        role: Role.STUDENT,
        roleBadge: 'Member',
        joinedDate: '2025-01-01',
      });
    });

    it('should return full profile for verified therapist', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: '2',
        username: 'therapist1',
        role: Role.THERAPIST,
        createdAt: new Date('2024-01-01'),
        profession: 'Psychologist',
        workplace: 'Clinic',
        bio: 'Hello',
        therapistVerification: { status: VerificationStatus.APPROVED },
      });

      mockPrismaService.post.findMany.mockResolvedValue([
        { id: 'p1', title: 'Post 1', createdAt: new Date('2025-02-01') },
      ]);
      mockPrismaService.comment.findMany.mockResolvedValue([
        {
            id: 'c1',
            content: 'Comment 1',
            createdAt: new Date('2025-02-02'),
            postId: 'p2',
            post: { title: 'Post 2' }
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/profile/therapist1')
        .expect(200);

      expect(res.body.username).toBe('therapist1');
      expect(res.body.roleBadge).toBe('Licensed Therapist');
      expect(res.body.profession).toBe('Psychologist');
      expect(res.body.verificationBadge).toBe('Verified Therapist');
      expect(res.body.recentPosts).toHaveLength(1);
      expect(res.body.recentComments).toHaveLength(1);
      expect(res.body.recentPosts[0].id).toBe('p1');
    });
  });
});
