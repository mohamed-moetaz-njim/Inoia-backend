import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async signup(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const emailExists = await this.usersService.isEmailTaken(email);
    if (emailExists) throw new ConflictException('Email already exists');

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.usersService.create({
      email,
      passwordHash,
      role: Role.STUDENT,
      username: '', // Generated server-side
    });

    const verificationToken = uuidv4();
    const hashedVerificationToken = await argon2.hash(verificationToken);

    await this.usersService.update({
      where: { id: user.id },
      data: { verificationToken: hashedVerificationToken },
    });

    // Send composite token (userId.token) to allow lookup by token
    const compositeToken = `${user.id}.${verificationToken}`;
    await this.emailService.sendVerificationEmail(dto.email, compositeToken);

    return {
      message:
        'User registered. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async signupTherapist(dto: RegisterTherapistDto) {
    const email = dto.email.toLowerCase();
    const emailExists = await this.usersService.isEmailTaken(email);
    if (emailExists) throw new ConflictException('Email already exists');

    const passwordHash = await argon2.hash(dto.password);
    const verificationToken = uuidv4();
    const hashedVerificationToken = await argon2.hash(verificationToken);

    // Use transaction to ensure both User and Verification Request are created
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await this.usersService.createInTx(tx, {
        email,
        passwordHash,
        role: Role.STUDENT, // Starts as student until approved
        username: '', // Generated server-side
        profession: dto.profession,
        workplace: dto.workplace,
        bio: dto.bio,
        verificationToken: hashedVerificationToken,
      });

      await tx.therapistVerification.create({
        data: {
          userId: newUser.id,
          certificationReference: dto.certificationReference,
          status: VerificationStatus.PENDING,
        },
      });

      return newUser;
    });

    // Send composite token (userId.token)
    const compositeToken = `${user.id}.${verificationToken}`;
    await this.emailService.sendVerificationEmail(dto.email, compositeToken);

    return {
      message:
        'Therapist application received. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async resendVerificationEmail(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await this.usersService.findOne({ email });

    // Prevent account enumeration
    if (!user) {
      return {
        message:
          'If your email is registered, a verification link has been sent.',
      };
    }

    // Skip resending if already verified
    if (!user.verificationToken) {
      return { message: 'Email is already verified.' };
    }

    const verificationToken = uuidv4();
    const hashedVerificationToken = await argon2.hash(verificationToken);

    await this.usersService.update({
      where: { id: user.id },
      data: { verificationToken: hashedVerificationToken },
    });

    // Send composite token
    const compositeToken = `${user.id}.${verificationToken}`;
    await this.emailService.sendVerificationEmail(email, compositeToken);

    return {
      message:
        'If your email is registered, a verification link has been sent.',
    };
  }

  async signin(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.usersService.findOne({ email });
    if (!user) throw new UnauthorizedException('Access Denied');
    if (user.deletedAt) throw new UnauthorizedException('Access Denied');
    if (!user.passwordHash) throw new UnauthorizedException('Access Denied');

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMatches) throw new UnauthorizedException('Access Denied');

    // Block login if email is not verified
    if (user.verificationToken) {
      throw new ForbiddenException('Email not verified');
    }

    const tokens = await this.getTokens(user.id, user.username, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.usersService.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async refreshTokens(userId: string, rt: string) {
    const user = await this.usersService.findOne({ id: userId });
    if (!user || !user.refreshTokenHash)
      throw new ForbiddenException('Access Denied');

    const rtMatches = await argon2.verify(user.refreshTokenHash, rt);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    const tokens = await this.getTokens(user.id, user.username, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async verifyEmail(emailInput: string | undefined, token: string) {
    let user;
    let actualToken = token;

    // Check if token is composite (userId.token)
    if (token.includes('.')) {
      const [userId, uuid] = token.split('.');
      // Basic validation of UUID format could be added here
      if (userId && uuid) {
        user = await this.usersService.findOne({ id: userId });
        actualToken = uuid;
      }
    }

    // Fallback to email lookup if provided and user not found yet
    if (!user && emailInput) {
      const email = emailInput.toLowerCase();
      user = await this.usersService.findOne({ email });
    }

    if (!user || !user.verificationToken)
      throw new BadRequestException('Invalid request or user already verified');

    const matches = await argon2.verify(user.verificationToken, actualToken);
    if (!matches) throw new BadRequestException('Invalid or expired verification token');

    // Verification link expires after 24 hours
    const now = new Date();
    const tokenAge = now.getTime() - user.updatedAt.getTime();
    if (tokenAge > 24 * 60 * 60 * 1000) {
      await this.usersService.update({
        where: { id: user.id },
        data: { verificationToken: null },
      });
      throw new BadRequestException('Token expired');
    }

    await this.usersService.update({
      where: { id: user.id },
      data: { verificationToken: null }, // Clear token to mark as verified
    });
    return { message: 'Email verified successfully. You can now log in.' };
  }

  async updateRefreshToken(userId: string, rt: string) {
    const hash = await argon2.hash(rt);
    await this.usersService.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  async getTokens(userId: string, username: string, role: Role) {
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync({ sub: userId, username, role }, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRES_IN'),
      } as any),
      this.jwtService.signAsync({ sub: userId, username, role }, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('REFRESH_EXPIRES_IN'),
      } as any),
    ]);

    return {
      accessToken: at,
      refreshToken: rt,
    };
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await this.usersService.findOne({ email });
    if (!user)
      return { message: 'If email exists, a reset link has been sent.' }; // Prevent account enumeration

    const resetToken = uuidv4();
    const hashedResetToken = await argon2.hash(resetToken);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.usersService.update({
      where: { id: user.id },
      data: {
        resetToken: hashedResetToken,
        resetTokenExpiresAt: expiresAt,
      },
    });

    await this.emailService.sendPasswordResetEmail(email, resetToken);
    return { message: 'If email exists, a reset link has been sent.' };
  }

  async resetPassword(emailInput: string, token: string, newPassword: string) {
    const email = emailInput.toLowerCase();
    const user = await this.usersService.findOne({ email });
    if (!user || !user.resetToken)
      throw new BadRequestException('Invalid request');

    const matches = await argon2.verify(user.resetToken, token);
    if (!matches) throw new BadRequestException('Invalid token');

    if (!user.resetTokenExpiresAt || new Date() > user.resetTokenExpiresAt) {
      await this.usersService.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpiresAt: null },
      });
      throw new BadRequestException('Token expired');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.usersService.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        refreshTokenHash: null, // Invalidate all sessions
      },
    });

    return { message: 'Password reset successfully' };
  }
}
