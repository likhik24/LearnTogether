import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsGateway {
  private readonly baseUrl: string;
  private readonly internalSecret: string;
  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('PAYMENTS_API_URL', 'http://localhost:3007')
      .replace(/\/$/, '');
    this.internalSecret = config.get<string>(
      'INTERNAL_SERVICE_SECRET',
      'dev-insecure-internal-secret',
    );
  }

  async assertReady(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/ready`);
      const body = (await response.json()) as { ready?: boolean };
      if (!response.ok || !body.ready)
        throw new ServiceUnavailableException('Online payments are temporarily unavailable');
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Online payments are temporarily unavailable');
    }
  }

  async refund(authorization: string, bookingId: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/payments/booking/${encodeURIComponent(bookingId)}/refund`,
        {
          method: 'POST',
          headers: {
            authorization,
            'content-type': 'application/json',
            'x-internal-service-token': this.internalSecret,
          },
        },
      );
    } catch {
      throw new BadGatewayException('Payment refund service is unavailable');
    }
    if (!response.ok)
      throw new BadGatewayException(
        'The payment could not be refunded; the booking was not cancelled',
      );
  }
}
