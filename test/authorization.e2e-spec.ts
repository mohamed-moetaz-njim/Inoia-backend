import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get(PrismaService);
    // Cleanup
    // await prisma.cleanDb(); // Use manual clean
  });

  afterAll(async () => {
    await app.close();
  });

  // Manual clean helper if not in service
  const cleanDb = async () => {
    // Delete in order of dependencies
    await prisma.vote.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.report.deleteMany();
    await prisma.post.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.aiMessage.deleteMany();
    await prisma.aiConversation.deleteMany();
    await prisma.adminAction.deleteMany();
    await prisma.therapistVerification.deleteMany();
    await prisma.user.deleteMany();
  };

  beforeEach(async () => {
    await cleanDb();
  });

  describe('Role Guards', () => {
    it('Student cannot access Admin routes', async () => {
      // Create student
      const student = await prisma.user.create({
        data: {
          email: 'student@test.com',
          role: Role.STUDENT,
          username: 'StudentOwl',
          passwordHash: await argon2.hash('password123'),
        },
      });
      // Login
      const loginRes = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: 'student@test.com', password: 'password123' });
      const token = loginRes.body.accessToken;

      // Try Admin Ban
      await request(app.getHttpServer())
        .post(`/admin/users/${student.id}/ban`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'test' })
        .expect(403);
    });

    it('Admin can access Admin routes', async () => {
      // Create admin
      const admin = await prisma.user.create({
        data: {
          email: 'admin@test.com',
          role: Role.ADMIN,
          username: 'AdminLion',
          passwordHash: await argon2.hash('password123'),
        },
      });
      const student = await prisma.user.create({
        data: {
          email: 'target@test.com',
          role: Role.STUDENT,
          username: 'Target',
        },
      });

      // Login
      const loginRes = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: 'admin@test.com', password: 'password123' });
      const token = loginRes.body.accessToken;

      // Try Admin Ban
      await request(app.getHttpServer())
        .post(`/admin/users/${student.id}/ban`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'test' })
        .expect(201);
    });
  });

  describe('Error Semantics', () => {
    it('Wrong password returns 401', async () => {
      await prisma.user.create({
        data: {
          email: 'student@test.com',
          role: Role.STUDENT,
          username: 'StudentOwl',
          passwordHash: await argon2.hash('password123'),
        },
      });

      await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: 'student@test.com', password: 'wrong' })
        .expect(401);
    });

    it('Deleted user access returns 404 (Resource Privacy)', async () => {
      const student = await prisma.user.create({
        data: {
          email: 'deleted@test.com',
          role: Role.STUDENT,
          username: 'DeletedBird',
          passwordHash: await argon2.hash('password123'),
          deletedAt: new Date(),
        },
      });

      // Need a valid token first. But deleted user can't login (AuthService checks deletedAt).
      // So we need to create user, login, THEN delete (soft), THEN access.

      // 1. Restore for login
      await prisma.user.update({
        where: { id: student.id },
        data: { deletedAt: null },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: 'deleted@test.com', password: 'password123' });
      const token = loginRes.body.accessToken;

      // 2. Soft delete
      await prisma.user.update({
        where: { id: student.id },
        data: { deletedAt: new Date() },
      });

      // 3. Access /users/me
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(404); // Not Found
    });
  });

  describe('Throttling (Basic Check)', () => {
    it('Refresh token invalidated on password reset', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'reset@test.com',
          role: Role.STUDENT,
          username: 'ResetBird',
          passwordHash: await argon2.hash('password123'),
        },
      });

      // 1. Login to get RT
      const loginRes = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: 'reset@test.com', password: 'password123' });
      const refreshToken = loginRes.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // 2. Request Reset
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      
      const resetReq = await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: await argon2.hash('token123'),
          resetTokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        },
      });

      // 3. Reset Password
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          email: 'reset@test.com',
          token: 'token123',
          newPassword: 'newpassword123',
        })
        .expect(200);

      // 4. Try Refresh
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .send()
        .expect(403); // Access Denied
    });

    it('Auth endpoint prevents rapid requests', async () => {
      // This might be flaky in test environment depending on Throttler config.
      // Config is 10 requests per minute.
      // Let's fire 15.
      const reqs = [];
      for (let i = 0; i < 15; i++) {
        reqs.push(
          request(app.getHttpServer())
            .post('/auth/signin')
            .send({ email: 'fake@test.com', password: 'fake' }),
        );
      }
      const responses = await Promise.all(reqs);
      const tooMany = responses.filter((r) => r.status === 429);
      // We expect at least some 429s
      expect(tooMany.length).toBeGreaterThan(0);
    });
  });
});
