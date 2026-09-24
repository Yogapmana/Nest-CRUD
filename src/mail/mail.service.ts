import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  sendPasswordReset(email: string, token: string): void {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    this.logger.log(
      `[DEV] Password reset untuk ${email}\nReset URL: ${resetUrl}\nToken: ${token}`,
    );
  }
}
