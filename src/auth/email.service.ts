import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get('RESEND_API_KEY'));
  }
  async sendVerificationEmail(email: string, token: string) {
    const appUrl = this.configService.get('APP_URL');
    const verificationUrl = `${appUrl}/api/auth/verify-email?token${token}`;

    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Verify Your email',
      html: `
      <h2>Welcome: Please verify your email</h2>
      <p>Click the link below to verify your email address</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>If You didn't create an account, you can safely ignore this email</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const appUrl = this.configService.get('APP_URL');
    const resetUrl = `${appUrl}/api/auth/reset-password?token${token}`;

    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Resting Your Password',
      html: `
      <h2>Alert: Password Reset Email</h2>
      <p>Click the link below to reset password </p>
      <a href="${resetUrl}">Reset Your Password</a>
      <p>If You didn't request a password reset, you can safely ignore this email</p>
      `,
    });
  }
}
