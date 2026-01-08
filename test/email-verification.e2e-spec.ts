import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/email/email.service';
import { ThrottlerGuard } from '@nestjs/throttler';

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
      .overrideGuard(ThrottlerGuard) // Disable rate limiting for tests
      .useValue({ canActivate: () => true })
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

  it('should allow resending verification email', async () => {
    const email = 'resend-test@example.com';
    const password = 'Password123!';

    // Ensure user doesn't exist
    await prisma.user.deleteMany({ where: { email } });

    // 1. Signup
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password })
      .expect(201);

    // 2. Resend Verification
    await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email })
      .expect(200);

    // Check if email service was called TWICE (signup + resend)
    // Note: Depends on if mocks persist across tests or cleared. 
    // We clear mocks in beforeEach, so it should be called once FOR THIS TEST's resend if we look carefully.
    // Actually, signup called it once. Resend called it again.
    // Since we didn't clear mocks BETWEEN steps in this test, count should be 2.
    expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledTimes(2);
    
    // 3. Verify with the NEW token
    const newToken = emailServiceMock.sendVerificationEmail.mock.calls[1][1]; // 2nd call
    
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, token: newToken })
      .expect(200);
      
    // Cleanup
    await prisma.user.deleteMany({ where: { email } });
  });

  it('should allow resending verification email with mixed case email', async () => {
    const email = 'MixedCase@example.com';
    const emailLower = 'mixedcase@example.com';
    const password = 'Password123!';

    // Ensure user doesn't exist
    await prisma.user.deleteMany({ where: { email: emailLower } }); // Prisma stores as is? Or we should check.
    // Assuming we haven't fixed it yet, it stores as MixedCase.

    // 1. Signup with MixedCase
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password })
      .expect(201);

    // 2. Resend Verification with lowercase
    await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: emailLower })
      .expect(200);

    // Check if email service was called
    // We expect it to be called for signup.
    // And if resend works, called again.
    // BUT since we run tests in parallel/sequence, call count is tricky.
    // We can check if the LAST call was to our email.
    
    // Actually, if we haven't fixed the bug, this test might pass the expect(200) but NOT call the email service for the second time.
    // So we need to be strict about call counts or args.
    
    // Let's rely on the fact that if it fails, it returns 200 but doesn't send email.
    // We need to inspect the mock.
    const calls = emailServiceMock.sendVerificationEmail.mock.calls;
    // Filter calls for this email
    const callsForThisUser = calls.filter(c => c[0].toLowerCase() === emailLower.toLowerCase());
    
    // Expect 2 calls: 1 for signup, 1 for resend
    expect(callsForThisUser.length).toBe(2);
    
    // Cleanup
    await prisma.user.deleteMany({ where: { email: emailLower } });
    await prisma.user.deleteMany({ where: { email: email } });
  });

  // it('should rate limit resend requests', async () => {
  //    // This requires Throttler to be active in test env.
  //    // In E2E, it usually is.
  //    // Limit is 3 per 10 mins.
  //    const email = 'spam@example.com';
     
  //    const reqs = [];
  //    for(let i=0; i<5; i++) {
  //       reqs.push(
  //         request(app.getHttpServer())
  //           .post('/auth/resend-verification')
  //           .send({ email })
  //       );
  //    }
     
  //    const responses = await Promise.all(reqs);
  //    const tooMany = responses.filter(r => r.status === 429);
  //    expect(tooMany.length).toBeGreaterThan(0);
  // });
});
