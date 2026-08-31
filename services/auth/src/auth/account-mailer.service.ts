import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetAccountCommand, SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { EmailReadinessDto } from '@learn-and-build/types';

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

  notification(
    email: string,
    displayName: string,
    subject: string,
    message: string,
  ): Promise<void> {
    return this.send(
      email,
      subject,
      `Hello ${displayName},\n\n${message}\n\nOpen Learn & Build: ${this.appUrl()}\n\nYou can change email notification preferences from your profile.`,
    );
  }

  async readiness(): Promise<EmailReadinessDto> {
    const fromAddress = this.config.get<string>('AUTH_EMAIL_FROM') ?? null;
    const region = this.config.get<string>('AWS_REGION', 'ap-southeast-2');
    if (!fromAddress)
      return {
        configured: false,
        fromAddress,
        region,
        sendingEnabled: null,
        productionAccessEnabled: null,
        error: 'AUTH_EMAIL_FROM is not configured',
      };
    try {
      const account = await this.client.send(new GetAccountCommand({}));
      return {
        configured: true,
        fromAddress,
        region,
        sendingEnabled: account.SendingEnabled ?? null,
        productionAccessEnabled: account.ProductionAccessEnabled ?? null,
        error: null,
      };
    } catch (error) {
      return {
        configured: true,
        fromAddress,
        region,
        sendingEnabled: null,
        productionAccessEnabled: null,
        error: error instanceof Error ? error.message : 'SES status unavailable',
      };
    }
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
            Body: {
              Text: { Data: body, Charset: 'UTF-8' },
              Html: { Data: emailHtml(subject, body), Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
  }
}

function emailHtml(subject: string, body: string): string {
  const content = escapeHtml(body).replace(/\n/g, '<br>');
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,sans-serif;color:#24211f"><div style="max-width:600px;margin:0 auto;padding:36px 20px"><div style="font-weight:900;letter-spacing:.12em;color:#6c43d5">LEARNTOGETHER</div><div style="margin-top:18px;padding:28px;background:#fff;border-radius:18px"><h1 style="font-size:24px;margin:0 0 18px">${escapeHtml(subject)}</h1><p style="font-size:15px;line-height:1.7;margin:0">${content}</p></div><p style="font-size:12px;color:#777;margin-top:18px">LearnTogether · learnandbuild.org</p></div></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}
