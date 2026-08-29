import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type Bucket = { count: number; resetsAt: number };

/** Small, dependency-free limiter for credential and recovery endpoints. */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000;
  private readonly limit = 10;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() ||
      request.ip ||
      'unknown';
    const key = `${ip}:${request.path}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetsAt <= now) {
      this.buckets.set(key, { count: 1, resetsAt: now + this.windowMs });
      this.prune(now);
      return true;
    }
    bucket.count += 1;
    if (bucket.count > this.limit) {
      throw new HttpException(
        'Too many attempts. Please wait a minute and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private prune(now: number): void {
    if (this.buckets.size < 5_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetsAt <= now) this.buckets.delete(key);
    }
  }
}
