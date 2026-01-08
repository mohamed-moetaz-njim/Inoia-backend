import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/email/email.service';

describe('Email Verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emailServiceMock = {
    sendVerificationEmail: jest.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: 'verify-test@example.com' } });
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send email on signup and verify successfully', async () => {
    const email = 'verify-test@example.com';
    const password = 'Password123!';

    // Ensure user doesn't exist
    await prisma.user.deleteMany({ where: { email } });

    // 1. Signup
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password })
      .expect(201);

    expect(signupRes.body).toHaveProperty('message');
    // Token should NOT be in response
    expect(signupRes.body).not.toHaveProperty('verificationToken');

    // Check if email service was called
    expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
      email,
      expect.any(String),
    );

    // Get the token from the mock call
    // Note: If multiple tests run, make sure to get the right call. 
    // Since we clear mocks in beforeEach, calls[0] should be this test's call.
    const token = emailServiceMock.sendVerificationEmail.mock.calls[0][1];

    // 2. Try to Login before verification (should fail)
    await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(403); // Forbidden

    // 3. Verify Email
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, token })
      .expect(200);

    // 4. Login should work now
    await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(200);
  });
});
