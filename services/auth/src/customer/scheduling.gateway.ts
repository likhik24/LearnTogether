import { BadGatewayException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClassReservationDto } from '@learn-and-build/types';

@Injectable()
export class SchedulingGateway {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('SCHEDULING_API_URL', 'http://localhost:3004').replace(/\/$/, '');
  }

  reserve(authorization: string, classId: string, occurrenceStart: string): Promise<ClassReservationDto> {
    return this.request<ClassReservationDto>(`/classes/${encodeURIComponent(classId)}/reservations`, authorization, {
      method: 'POST',
      body: JSON.stringify({ occurrenceStart, seats: 1 }),
    });
  }

  release(authorization: string, classId: string, reservationId: string): Promise<ClassReservationDto> {
    return this.request<ClassReservationDto>(`/classes/${encodeURIComponent(classId)}/reservations/${encodeURIComponent(reservationId)}`, authorization, { method: 'DELETE' });
  }

  private async request<T>(path: string, authorization: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', authorization },
      });
    } catch {
      throw new BadGatewayException('Scheduling service is unavailable');
    }
    if (!response.ok) {
      const message = await response.text();
      if (response.status === 409) throw new ConflictException('This class has just sold out');
      throw new BadGatewayException(`Scheduling request failed (${response.status}): ${message}`);
    }
    return response.json() as Promise<T>;
  }
}
