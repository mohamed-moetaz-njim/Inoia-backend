import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  BadRequestException,
  InternalServerErrorException,
  Get,
  Controller,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { Public } from '../src/common/decorators';

@Controller('test-exceptions')
class TestExceptionsController {
  @Public()
  @Get('error')
  throwError() {
    throw new Error('Simulated Error');
  }

  @Public()
  @Get('bad-request')
  throwBadRequest() {
    throw new BadRequestException('Validation failed');
  }
}

describe('GlobalExceptionFilter (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestExceptionsController],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Register filter manually for testing env as main.ts is not executed here
    const httpAdapter = app.get(HttpAdapterHost);
    app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should handle 404 Not Found', () => {
    return request(app.getHttpServer())
      .get('/non-existent-route')
      .expect(404)
      .expect((res) => {
        expect(res.body).toEqual({
          statusCode: 404,
          timestamp: expect.any(String),
          path: '/non-existent-route',
          message: 'Cannot GET /non-existent-route',
        });
      });
  });

  it('should handle 400 Bad Request', () => {
    return request(app.getHttpServer())
      .get('/test-exceptions/bad-request')
      .expect(400)
      .expect((res) => {
        expect(res.body).toEqual({
          statusCode: 400,
          timestamp: expect.any(String),
          path: '/test-exceptions/bad-request',
          message: 'Validation failed',
        });
      });
  });

  it('should handle 500 Internal Server Error', () => {
    return request(app.getHttpServer())
      .get('/test-exceptions/error')
      .expect(500)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 500,
            timestamp: expect.any(String),
            path: '/test-exceptions/error',
            message: 'Internal server error',
          }),
        );
      });
  });
});
