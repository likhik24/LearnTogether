import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

@Injectable()
export class AccountMailerService {
  private readonly logger = new Logger(AccountMailerService.name);
  private readonly client: SESv2Client;

  constructor(private readonly config: ConfigService) {
    this.client = new SESv2Client({
      region: this.config.get<string>('AWS_REGION', 'ap-southeast-2'),
    });
  }

  verification(email: string, displayName: string, token: string): Promise<void> {
    const url = `${this.appUrl()}/profile?verify_token=${encodeURIComponent(token)}`;
    return this.send(
      email,
      'Verify your Learn & Build email',
      `Hello ${displayName},\n\nVerify your email to secure your Learn & Build account:\n${url}\n\nThis link expires in 24 hours.`,
    );
  }

  passwordReset(email: string, displayName: string, token: string): Promise<void> {
    const url = `${this.appUrl()}/profile?reset_token=${encodeURIComponent(token)}`;
    return this.send(
      email,
      'Reset your Learn & Build password',
      `Hello ${displayName},\n\nUse this link to choose a new password:\n${url}\n\nThis link expires in 30 minutes. If you did not request it, you can ignore this email.`,
    );
  }

  private appUrl(): string {
    return this.config.get<string>('APP_URL', 'http://localhost:3100').replace(/\/$/, '');
  }

  private async send(to: string, subject: string, body: string): Promise<void> {
    const from = this.config.get<string>('AUTH_EMAIL_FROM');
    if (!from) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.error('AUTH_EMAIL_FROM is missing; account email could not be delivered');
      } else {
        this.logger.log(`[email preview] ${to}: ${subject}\n${body}`);
      }
      return;
    }
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Text: { Data: body, Charset: 'UTF-8' } },
          },
        },
      }),
    );
  }
}
