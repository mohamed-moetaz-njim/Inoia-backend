import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Public, GetCurrentUserId, GetCurrentUser } from '../common/decorators';
import { RtGuard } from '../common/guards';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({ status: 403, description: 'Credentials taken.' })
  signup(@Body() dto: RegisterDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User successfully logged in.' })
  @ApiResponse({ status: 403, description: 'Invalid credentials.' })
  signin(@Body() dto: LoginDto) {
    return this.authService.signin(dto);
  }

  @Public()
  @Post('resend-verification')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 600000 } }) // 3 requests per 10 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent if user exists and is unverified.',
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User successfully logged out.' })
  logout(@GetCurrentUserId() userId: string) {
    return this.authService.logout(userId);
  }

  @Public()
  @UseGuards(RtGuard)
  @Post('refresh')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh tokens' })
  @ApiResponse({ status: 200, description: 'Tokens successfully refreshed.' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token.' })
  refreshTokens(
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email successfully verified.' })
  verifyEmail(@Body('email') email: string, @Body('token') token: string) {
    return this.authService.verifyEmail(email, token);
  }

  @Public()
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email via token (link)' })
  @ApiQuery({ name: 'token', required: true, description: 'Verification token from email' })
  @ApiResponse({
    status: 302,
    description: 'Email verified successfully. Redirects to frontend login.',
  })
  @ApiResponse({ status: 302, description: 'Invalid or expired verification token. Redirects to frontend with error.' })
  async verifyEmailLink(@Query('token') token: string, @Res() res: Response) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    try {
      await this.authService.verifyEmail(undefined, token);
      return res.redirect(`${frontendUrl}`);
    } catch (error) {
      return res.redirect(`${frontendUrl}`);
    }
  }

  @Public()
  @Post('request-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset email sent if user exists.' })
  requestReset(@Body('email') email: string) {
    return this.authService.requestPasswordReset(email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password successfully reset.' })
  resetPassword(
    @Body('email') email: string,
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(email, token, newPassword);
  }
}
