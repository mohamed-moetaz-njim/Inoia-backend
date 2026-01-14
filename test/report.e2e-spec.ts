import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Global,
  Module,
} from '@nestjs/common';
import request from 'supertest';
import { ReportModule } from './../src/report/report.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { ReportStatus, Role } from '@prisma/client';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { ExecutionContext } from '@nestjs/common';

interface MockPrismaServiceType {
  post: { findUnique: jest.Mock; update: jest.Mock };
  comment: { findUnique: jest.Mock; update: jest.Mock };
  report: {
    findFirst: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  adminAction: { create: jest.Mock };
  $transaction: jest.Mock;
}

const mockPrismaService: MockPrismaServiceType = {
  post: { findUnique: jest.fn(), update: jest.fn() },
  comment: { findUnique: jest.fn(), update: jest.fn() },
  report: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  adminAction: { create: jest.fn() },
  $transaction: jest.fn((cb: (prisma: any) => any) => cb(mockPrismaService)),
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: mockPrismaService as unknown as PrismaService }],
  exports: [PrismaService],
})
class MockPrismaModule {}

describe('ReportController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const mockAtGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const userId = req.headers['x-user-id'] || 'user-id';
      const role = req.headers['x-role'] || Role.STUDENT;
      req.user = { sub: userId, role };
      return true;
    },
  };

  const mockRolesGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const user = req.user;
      if (req.route.path.includes('admin') && user?.role !== 'ADMIN')
        return false;
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MockPrismaModule,
        ReportModule,
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
      ],
      providers: [
        { provide: APP_GUARD, useValue: mockAtGuard },
        { provide: APP_GUARD, useValue: mockRolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/reports (POST)', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const otherUuid = '123e4567-e89b-12d3-a456-426614174001';

    it('should create a report', () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: validUuid,
        authorId: 'other-id',
      });
      mockPrismaService.report.findFirst.mockResolvedValue(null);
      mockPrismaService.report.create.mockResolvedValue({ id: 'report-id' });

      return request(app.getHttpServer())
        .post('/reports')
        .set('x-user-id', 'student-id')
        .set('x-role', Role.STUDENT)
        .send({ reason: 'Spam', postId: validUuid })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toEqual('Report submitted successfully');
        });
    });

    it('should return 400 for duplicate report', () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: validUuid,
        authorId: 'other-id',
      });
      mockPrismaService.report.findFirst.mockResolvedValue({ id: 'existing' });

      return request(app.getHttpServer())
        .post('/reports')
        .set('x-user-id', 'student-id')
        .send({ reason: 'Spam', postId: validUuid })
        .expect(400);
    });
  });

  describe('/admin/reports (GET)', () => {
    it('should return reports for admin', () => {
      mockPrismaService.report.findMany.mockResolvedValue([]);
      mockPrismaService.report.count.mockResolvedValue(0);

      return request(app.getHttpServer())
        .get('/admin/reports')
        .set('x-role', Role.ADMIN)
        .expect(200);
    });

    it('should forbid non-admin', () => {
      return request(app.getHttpServer())
        .get('/admin/reports')
        .set('x-role', Role.STUDENT)
        .expect(403);
    });
  });

  describe('/admin/reports/:id (PATCH)', () => {
    it('should update report status', () => {
      mockPrismaService.report.findUnique.mockResolvedValue({
        id: 'report-id',
        postId: 'post-id',
      });
      mockPrismaService.report.update.mockResolvedValue({
        id: 'report-id',
        status: ReportStatus.RESOLVED,
      });

      return request(app.getHttpServer())
        .patch('/admin/reports/report-id')
        .set('x-role', Role.ADMIN)
        .set('x-user-id', 'admin-id')
        .send({ status: ReportStatus.RESOLVED })
        .expect(200);
    });

    it('should forbid non-admin', () => {
      return request(app.getHttpServer())
        .patch('/admin/reports/report-id')
        .set('x-role', Role.STUDENT)
        .send({ status: ReportStatus.RESOLVED })
        .expect(403);
    });
  });
});
