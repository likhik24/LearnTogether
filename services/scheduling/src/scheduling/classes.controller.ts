import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  Role,
  type AuthPrincipal,
} from '@learn-and-build/nest-auth';
import type {
  ClassOccurrence,
  ClassOfferingDto,
} from '@learn-and-build/types';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  /** Verified teachers publish classes. */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  async create(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreateClassDto,
  ): Promise<ClassOfferingDto> {
    const offering = await this.classes.create(user.sub, dto);
    return offering.toDto();
  }

  /** A teacher's own classes. */
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  async mine(
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ClassOfferingDto[]> {
    const list = await this.classes.listByTeacher(user.sub);
    return list.map((c) => c.toDto());
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<ClassOfferingDto> {
    const offering = await this.classes.getOrThrow(id);
    return offering.toDto();
  }

  /** Public availability query: upcoming occurrences with seat counts. */
  @Get(':id/availability')
  availability(
    @Param('id') id: string,
    @Query('days', new DefaultValuePipe(14), ParseIntPipe) days: number,
  ): Promise<ClassOccurrence[]> {
    return this.classes.availability(id, days);
  }
}
