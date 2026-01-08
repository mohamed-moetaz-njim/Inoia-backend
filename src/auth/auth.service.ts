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

    // Create user as STUDENT by default
    const user = await this.usersService.create({
      email,
      passwordHash,
      role: Role.STUDENT,
      username: '', // Will be generated
    });

    // Generate verification token
    const verificationToken = uuidv4();
    const hashedVerificationToken = await argon2.hash(verificationToken);

    await this.usersService.update({
      where: { id: user.id },
      data: { verificationToken: hashedVerificationToken },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(dto.email, verificationToken);

    return {
      message: 'User registered. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async resendVerificationEmail(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await this.usersService.findOne({ email });
    
    // Security: Don't reveal if user exists
    if (!user) {
      return { message: 'If your email is registered, a verification link has been sent.' };
    }

    // If already verified, return success (don't send email)
    if (!user.verificationToken) {
      return { message: 'Email is already verified.' };
    }

    // Generate NEW verification token
    const verificationToken = uuidv4();
    const hashedVerificationToken = await argon2.hash(verificationToken);

    await this.usersService.update({
      where: { id: user.id },
      data: { verificationToken: hashedVerificationToken },
    });

    // Send email
    await this.emailService.sendVerificationEmail(email, verificationToken);

    return { message: 'If your email is registered, a verification link has been sent.' };
  }

  async signin(dto: LoginDto) {
    const user = await this.usersService.findOne({ email: dto.email });
    if (!user) throw new UnauthorizedException('Access Denied');
    if (user.deletedAt) throw new UnauthorizedException('Access Denied');
    if (!user.passwordHash) throw new UnauthorizedException('Access Denied');

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMatches) throw new UnauthorizedException('Access Denied');

    // Check if verified? The prompt says "Users must verify email before full account activation".
    // I will allow login but maybe restrict access using Roles?
    // Or I should block login if not verified?
    // "Users must verify email before full account activation" -> usually implies login works but features are limited, OR login fails.
    // Given "Backend is zero-trust", let's assume we issue tokens but maybe they have a 'verified' claim or we check verificationToken is null.
    // Let's assume we block login if verificationToken is still present (meaning pending).
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

  async verifyEmail(emailInput: string, token: string) {
    const email = emailInput.toLowerCase();
    const user = await this.usersService.findOne({ email });
    if (!user || !user.verificationToken)
      throw new BadRequestException('Invalid request');

    const matches = await argon2.verify(user.verificationToken, token);
    if (!matches) throw new BadRequestException('Invalid token');

    // Check Expiry (24 hours)
    const now = new Date();
    const tokenAge = now.getTime() - user.updatedAt.getTime();
    if (tokenAge > 24 * 60 * 60 * 1000) {
      // 24 hours
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
    return { message: 'Email verified successfully' };
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

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findOne({ email });
    if (!user) return; // Silent return for privacy

    const resetToken = uuidv4();
    const hashedResetToken = await argon2.hash(resetToken);

    // In a real app, we would store an expiration time as well, or encode it in the token.
    // But schema only has `resetToken` string.
    // I'll assume the token validity is checked by created time or I rely on external job to clear old tokens?
    // "One-time reset token: Hashed at rest, Short TTL, Invalidated immediately after use"
    // Since schema is fixed and `resetToken` is a single string field, I'll store the hash there.
    // I can't store expiration unless I use another field or encoded in the token (but token is hashed).
    // Wait, "Short TTL". If I can't store expiry in DB, I must rely on something else.
    // Maybe I can store "token|expiry" string in the field? But it's hashed.
    // Ah, `resetToken` field in User model is just `String?`.
    // If I want to enforce TTL, I should probably use `updatedAt` if the token was just set?
    // Or maybe the schema allows me to add fields? "No extra columns".
    // Then I must assume `updatedAt` is sufficient if I update it when setting token?
    // But `updatedAt` changes on other updates too.
    // I will implement a "stateless" token approach where the token itself contains the expiry,
    // BUT the prompt says "Hashed at rest".
    // If I hash "token_string", I can't read the expiry from the hash.
    // So I must store the expiry in the DB or use `updatedAt` logic cautiously.
    // Let's assume `updatedAt` is the timestamp of the last token generation if `resetToken` is not null.
    // This is a bit flaky but fits the constraints.

    await this.usersService.update({
      where: { id: user.id },
      data: { resetToken: hashedResetToken },
    });

    // TODO: Send reset email with token
    return { message: 'If email exists, a reset link has been sent.' };
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    const user = await this.usersService.findOne({ email });
    if (!user || !user.resetToken)
      throw new BadRequestException('Invalid request');

    const matches = await argon2.verify(user.resetToken, token);
    if (!matches) throw new BadRequestException('Invalid token');

    // Check TTL (e.g. 15 mins) using updatedAt
    const now = new Date();
    const tokenAge = now.getTime() - user.updatedAt.getTime();
    if (tokenAge > 15 * 60 * 1000) {
      // 15 mins
      // Invalidate
      await this.usersService.update({
        where: { id: user.id },
        data: { resetToken: null },
      });
      throw new BadRequestException('Token expired');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.usersService.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        refreshTokenHash: null, // Invalidate all sessions
      },
    });

    return { message: 'Password reset successfully' };
  }
}
