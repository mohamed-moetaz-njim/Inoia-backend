import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
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
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/verify?token=${token}`;
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
        this.logger.error(`Failed to send email to ${email}: ${response.error.message}`);
        throw new InternalServerErrorException('Failed to send verification email');
      }
      
      this.logger.log(`Verification email sent to ${email}, ID: ${response.data?.id}`);
      return response;
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.logger.error(`Failed to send email to ${email}`, error);
      // Don't block signup if email fails, but maybe we should? 
      // User said "Real email verification", so if email fails, user can't verify.
      // But logging it is safer than crashing the request for now, unless we want strict behavior.
      // I'll rethrow or handle gracefully.
      // Let's throw so the user knows something went wrong, or return null.
      throw new InternalServerErrorException('Failed to send verification email');
    }
  }
}
