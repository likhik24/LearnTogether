import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ClassOccurrence } from '@learn-and-build/types';
import { ClassOffering } from './class-offering.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { assertValidTimings, generateOccurrences } from './timing';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(ClassOffering)
    private readonly classes: Repository<ClassOffering>,
  ) {}

  async create(teacherId: string, dto: CreateClassDto): Promise<ClassOffering> {
    try {
      assertValidTimings(dto.timings, dto.durationMinutes);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid timings',
      );
    }

    const offering = this.classes.create({
      teacherId,
      activity: dto.activity,
      description: dto.description ?? null,
      instructorGender: dto.instructorGender,
      durationMinutes: dto.durationMinutes,
      seats: dto.seats,
      timings: dto.timings,
      location: dto.location
        ? { type: 'Point', coordinates: [dto.location.lng, dto.location.lat] }
        : null,
    });
    return this.classes.save(offering);
  }

  findById(id: string): Promise<ClassOffering | null> {
    return this.classes.findOne({ where: { id } });
  }

  listByTeacher(teacherId: string): Promise<ClassOffering[]> {
    return this.classes.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrThrow(id: string): Promise<ClassOffering> {
    const offering = await this.findById(id);
    if (!offering) {
      throw new NotFoundException(`Class ${id} not found`);
    }
    return offering;
  }

  /** Upcoming occurrences with seat availability for the next `days`. */
  async availability(id: string, days: number): Promise<ClassOccurrence[]> {
    const offering = await this.getOrThrow(id);
    return generateOccurrences(
      offering.timings ?? [],
      offering.durationMinutes,
      offering.seats,
      { days },
    );
  }
}
