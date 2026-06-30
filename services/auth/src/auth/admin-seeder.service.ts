import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Role } from '@learn-and-build/types';
import { UsersService } from '../users/users.service';

/**
 * Seeds an initial ADMIN account from ADMIN_EMAIL / ADMIN_PASSWORD env vars,
 * if set and not already present. Lets the admin console be used immediately
 * in a fresh environment. No-op when the env vars are missing.
 */
@Injectable()
export class AdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) {
      return;
    }

    const existing = await this.users.findByEmail(email);
    if (existing) {
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.users.create({
      email,
      passwordHash,
      displayName: this.config.get<string>('ADMIN_NAME', 'Administrator'),
      role: Role.ADMIN,
    });
    this.logger.log(`Seeded initial admin account: ${email}`);
  }
}
