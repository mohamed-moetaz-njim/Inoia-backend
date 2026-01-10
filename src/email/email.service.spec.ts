import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

// Mock Resend
const mockResend = {
  emails: {
    send: jest.fn(),
  },
};

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => mockResend),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return null;
            }),
            getOrThrow: jest.fn((key) => {
              if (key === 'RESEND_API_KEY') return 'test_key';
              if (key === 'FROM_EMAIL') return 'test@test.com';
              throw new Error(`Config ${key} not found`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationEmail', () => {
    it('should send an email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email_id' },
        error: null,
      });

      const email = 'user@example.com';
      const token = 'verification_token';

      await service.sendVerificationEmail(email, token);

      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'test@test.com',
        to: email,
        subject: 'Verify your email - Inoia',
        html: expect.stringContaining(token),
      });
    });

    it('should handle failure gracefully (return null) if sending fails', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'Send failed', name: 'error' },
      });

      const result = await service.sendVerificationEmail(
        'user@example.com',
        'token',
      );
      expect(result).toBeNull();
    });
  });
});
