import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

type Bucket = { count: number; resetsAt: number };
type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  method: string;
  path: string;
};

/** Per-process safety net. Cloudflare rate rules remain the distributed edge control. */
@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() ||
      request.ip ||
      'unknown';
    const limit = request.method === 'GET' ? 180 : 60;
    const key = `${ip}:${request.method}:${request.path}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetsAt <= now) {
      this.buckets.set(key, { count: 1, resetsAt: now + this.windowMs });
      this.prune(now);
      return true;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpException(
        'Too many requests. Please wait a minute and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private prune(now: number): void {
    if (this.buckets.size < 10_000) return;
    for (const [key, bucket] of this.buckets) if (bucket.resetsAt <= now) this.buckets.delete(key);
  }
}
