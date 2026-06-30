import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role, type PublicUser } from '@learn-and-build/types';
import { UsersService } from './users.service';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
} from '@learn-and-build/nest-auth';
import { SetRoleDto } from '../auth/dto/set-role.dto';

/**
 * Admin-only user management. Powers the admin console.
 * Every route requires a valid JWT (JwtAuthGuard) AND the ADMIN role
 * (RolesGuard + @Roles).
 */
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(): Promise<PublicUser[]> {
    const users = await this.users.findAll();
    return users.map((u) => u.toPublic());
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user.toPublic();
  }

  @Patch(':id/role')
  async setRole(
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
  ): Promise<PublicUser> {
    const user = await this.users.setRole(id, dto.role);
    return user.toPublic();
  }
}
