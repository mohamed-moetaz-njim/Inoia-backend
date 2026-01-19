import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.getOrThrow('RESEND_API_KEY'));
  }

  async sendVerificationEmail(email: string, token: string) {
    // Use BACKEND_URL for direct verification link, fallback to localhost for development
    const backendUrl =
      this.configService.get('BACKEND_URL') || 'http://localhost:3000';
    // Link points to Backend API -> which redirects to Frontend
    const verificationLink = `${backendUrl}/auth/verify?token=${token}`;
    const fromEmail = this.configService.getOrThrow('FROM_EMAIL');

    try {
      const response = await this.resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Verify your email - Inoia',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Inoia!</h2>
            <p>Please verify your email address to complete your registration.</p>
            <p>Click the button below to verify:</p>
            <a href="${verificationLink}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Verify Email</a>
            <p style="font-size: 12px; color: #666;">Or copy this link: ${verificationLink}</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      });

      if (response.error) {
        this.logger.error(
          `Failed to send email to ${email}: ${response.error.message}`,
        );
        return null;
      }

      this.logger.log(
        `Verification email sent to ${email}, ID: ${response.data?.id}`,
      );
      return response;
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.logger.error(`Failed to send email to ${email}`, error);
      return null;
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    const fromEmail = this.configService.getOrThrow('FROM_EMAIL');

    try {
      const response = await this.resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Reset your password - Inoia',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p>You requested a password reset for your Inoia account.</p>
            <p>Click the button below to reset your password. This link will expire in 15 minutes.</p>
            <a href="${resetLink}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
            <p style="font-size: 12px; color: #666;">Or copy this link: ${resetLink}</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });

      if (response.error) {
        this.logger.error(
          `Failed to send reset email to ${email}: ${response.error.message}`,
        );
      } else {
        this.logger.log(
          `Reset email sent to ${email}, ID: ${response.data?.id}`,
        );
      }
      return response;
    } catch (error) {
      this.logger.error(`Failed to send reset email to ${email}`, error);
      // Hide account existence; do not throw.
    }
  }
}
