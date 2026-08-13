import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, Role } from '@learn-and-build/nest-auth';
import type { ClassSearchResponse } from '@learn-and-build/types';
import { SearchService } from './search.service';
import { IndexClassDto } from './dto/index-class.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** Raw text query with an optional 5 km (default) geo filter. */
  @Get()
  query(
    @Query('q', new DefaultValuePipe('')) q: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius', new DefaultValuePipe('5000')) radius?: string,
  ): Promise<ClassSearchResponse> {
    const hasOrigin = lat !== undefined && lng !== undefined;
    return this.search.search({
      query: q,
      origin: hasOrigin ? { lat: Number(lat), lng: Number(lng) } : undefined,
      radiusMeters: hasOrigin ? Number(radius) : undefined,
    });
  }

  /** Index a single class (admin/internal). */
  @Post('index')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async index(@Body() dto: IndexClassDto): Promise<{ classId: string }> {
    const doc = await this.search.index(dto);
    return { classId: doc.classId };
  }

  /** Trigger a full reindex from the class database (admin). */
  @Post('reindex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async reindex(): Promise<{ indexed: number }> {
    return { indexed: await this.search.reindexAll() };
  }
}
