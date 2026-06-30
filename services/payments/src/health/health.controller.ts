import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@learn-and-build/types';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'payments',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
