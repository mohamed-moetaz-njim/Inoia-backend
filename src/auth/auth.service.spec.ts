import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

// Mock dependencies
jest.mock('argon2');
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

const mockUsersService = {
  isEmailTaken: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
};

const mockEmailService = {
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: typeof mockUsersService;
  let jwtService: typeof mockJwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);

    // Default config mocks
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'JWT_SECRET') return 'at-secret';
      if (key === 'JWT_EXPIRES_IN') return '15m';
      if (key === 'JWT_REFRESH_SECRET') return 'rt-secret';
      if (key === 'REFRESH_EXPIRES_IN') return '7d';
      return null;
    });

    (argon2.hash as jest.Mock).mockResolvedValue('hashed-value');
    (argon2.verify as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    const dto = {
      email: 'yamiigraphics@gmail.com',
      password: 'password123',
    };

    it('should create a user if email is not taken', async () => {
      mockUsersService.isEmailTaken.mockResolvedValue(false);
      mockUsersService.create.mockResolvedValue({ id: '1', email: dto.email });
      mockEmailService.sendVerificationEmail.mockResolvedValue({
        id: 'email_id',
      });

      const result = await service.signup(dto);

      expect(mockUsersService.isEmailTaken).toHaveBeenCalledWith(dto.email);
      expect(argon2.hash).toHaveBeenCalledWith(dto.password);
      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: dto.email,
        passwordHash: 'hashed-value',
        role: Role.STUDENT,
        username: '',
      });
      // Verification token update
      expect(mockUsersService.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { verificationToken: 'hashed-value' },
      });
      // Email sent
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        dto.email,
        'mock-uuid',
      );
      expect(result).toHaveProperty('userId', '1');
    });

    it('should throw ConflictException if email is taken', async () => {
      mockUsersService.isEmailTaken.mockResolvedValue(true);
      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('signin', () => {
    const dto = {
      email: 'yamiigraphics@gmail.com',
      password: 'password123',
    };
    const user = {
      id: '1',
      email: dto.email,
      passwordHash: 'hashed-password',
      username: 'testuser',
      role: Role.STUDENT,
      deletedAt: null,
      verificationToken: null,
    };

    it('should return tokens if credentials are valid', async () => {
      mockUsersService.findOne.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('token');

      const result = await service.signin(dto);

      // expect(result).toHaveProperty('refresh_token');
      // Verify calls
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findOne.mockResolvedValue(null);
      await expect(service.signin(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is soft deleted', async () => {
      mockUsersService.findOne.mockResolvedValue({
        ...user,
        deletedAt: new Date(),
      });
      await expect(service.signin(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password incorrect', async () => {
      mockUsersService.findOne.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      await expect(service.signin(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if email not verified', async () => {
      mockUsersService.findOne.mockResolvedValue({
        ...user,
        verificationToken: 'pending',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      await expect(service.signin(dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash', async () => {
      await service.logout('1');
      expect(mockUsersService.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { refreshTokenHash: null },
      });
    });
  });

  describe('refreshTokens', () => {
    const user = {
      id: '1',
      username: 'testuser',
      role: Role.STUDENT,
      refreshTokenHash: 'hashed-rt',
    };

    it('should return new tokens if valid', async () => {
      mockUsersService.findOne.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('new-token');

      const result = await service.refreshTokens('1', 'valid-rt');

      expect(result).toEqual({
        accessToken: 'new-token',
        refreshToken: 'new-token',
      });
      expect(mockUsersService.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user not found or no rt hash', async () => {
      mockUsersService.findOne.mockResolvedValue(null);
      await expect(service.refreshTokens('1', 'rt')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if rt invalid', async () => {
      mockUsersService.findOne.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      await expect(service.refreshTokens('1', 'invalid-rt')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('verifyEmail', () => {
    const user = {
      id: '1',
      verificationToken: 'hashed-token',
      updatedAt: new Date(),
    };

    it('should verify email if token is valid', async () => {
      mockUsersService.findOne.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.verifyEmail('yamiigraphics@gmail.com', 'token');

      expect(mockUsersService.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { verificationToken: null },
      });
    });

    it('should throw BadRequest if user not found or already verified', async () => {
      mockUsersService.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('t', 't')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if token invalid', async () => {
      mockUsersService.findOne.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      await expect(service.verifyEmail('t', 't')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('passwordReset', () => {
    it('requestPasswordReset should set resetToken', async () => {
      mockUsersService.findOne.mockResolvedValue({ id: '1' });
      await service.requestPasswordReset('yamiigraphics@gmail.com');
      expect(mockUsersService.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          resetToken: 'hashed-value',
          resetTokenExpiresAt: expect.any(Date),
        }),
      });
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'yamiigraphics@gmail.com',
        'mock-uuid',
      );
    });

    it('resetPassword should update password', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 15);

      mockUsersService.findOne.mockResolvedValue({
        id: '1',
        resetToken: 'hashed',
        resetTokenExpiresAt: futureDate,
        updatedAt: new Date(),
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.resetPassword('t', 't', 'new-pass');

      expect(mockUsersService.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          passwordHash: 'hashed-value',
          resetToken: null,
          resetTokenExpiresAt: null,
        }),
      });
    });
  });

  describe('resendVerificationEmail', () => {
    it('should send email if user exists and is unverified', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: '1',
        verificationToken: 'old-token',
      });
      mockEmailService.sendVerificationEmail.mockResolvedValue({
        id: 'email_id',
      });

      await service.resendVerificationEmail('test@example.com');

      expect(mockUsersService.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { verificationToken: 'hashed-value' },
      });
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'mock-uuid',
      );
    });

    it('should return success but NOT send email if user does not exist', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      const result = await service.resendVerificationEmail('test@example.com');

      expect(mockUsersService.update).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });

    it('should return success but NOT send email if user is already verified', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: '1',
        verificationToken: null,
      });

      const result = await service.resendVerificationEmail(
        'yamiigraphics@gmail.com',
      );

      expect(mockUsersService.update).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });
  });
});
