import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Validates the bearer JWT using the 'jwt' passport strategy. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
