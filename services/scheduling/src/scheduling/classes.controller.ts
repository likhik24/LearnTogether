import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
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
  ClassReservationDto,
  DiscoverClassDto,
} from '@learn-and-build/types';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { ReserveClassDto } from './dto/reserve-class.dto';

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

  /** Public customer discovery data with live occurrence capacity. */
  @Get('discover')
  discover(
    @Query('q', new DefaultValuePipe('')) query: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius', new DefaultValuePipe('5000')) radius?: string,
    @Query('days', new DefaultValuePipe('21')) days?: string,
  ): Promise<DiscoverClassDto[]> {
    const hasOrigin = lat !== undefined && lng !== undefined;
    return this.classes.discover({
      query,
      origin: hasOrigin ? { lat: Number(lat), lng: Number(lng) } : undefined,
      radiusMeters: Number(radius),
      days: Number(days),
    });
  }

  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string): Promise<ClassOfferingDto> {
    return (await this.classes.getBySlugOrThrow(slug)).toDto();
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

  @Post(':id/reservations')
  @UseGuards(JwtAuthGuard)
  async reserve(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ReserveClassDto,
  ): Promise<ClassReservationDto> {
    return (await this.classes.reserve(user.sub, id, dto)).toDto();
  }

  @Delete(':id/reservations/:reservationId')
  @UseGuards(JwtAuthGuard)
  async cancelReservation(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Param('reservationId') reservationId: string,
  ): Promise<ClassReservationDto> {
    return (await this.classes.cancelReservation(user.sub, id, reservationId)).toDto();
  }
}
