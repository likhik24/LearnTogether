import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import {
  ReservationStatus,
  type ClassOccurrence,
  type DiscoverClassDto,
  type GeoLocation,
} from '@learn-and-build/types';
import { ClassOffering } from './class-offering.entity';
import { ClassReservation } from './class-reservation.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { ReserveClassDto } from './dto/reserve-class.dto';
import { assertValidTimings, generateOccurrences } from './timing';

interface DiscoverQuery {
  query?: string;
  origin?: GeoLocation;
  radiusMeters?: number;
  days?: number;
}

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(ClassOffering)
    private readonly classes: Repository<ClassOffering>,
    @InjectRepository(ClassReservation)
    private readonly reservations: Repository<ClassReservation>,
    private readonly dataSource: DataSource,
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
      slug: dto.slug ?? null,
      activity: dto.activity,
      description: dto.description ?? null,
      category: dto.category ?? 'General',
      ageMin: dto.ageMin ?? 3,
      ageMax: dto.ageMax ?? 6,
      priceMinor: dto.priceMinor ?? 0,
      currency: dto.currency ?? 'INR',
      imageUrl: dto.imageUrl ?? null,
      tone: dto.tone ?? 'mint',
      rating: dto.rating ?? 0,
      reviewCount: dto.reviewCount ?? 0,
      venueName: dto.venueName ?? null,
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

  findBySlug(slug: string): Promise<ClassOffering | null> {
    return this.classes.findOne({ where: { slug } });
  }

  listByTeacher(teacherId: string): Promise<ClassOffering[]> {
    return this.classes.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrThrow(id: string): Promise<ClassOffering> {
    const offering = await this.findById(id);
    if (!offering) throw new NotFoundException(`Class ${id} not found`);
    return offering;
  }

  async getBySlugOrThrow(slug: string): Promise<ClassOffering> {
    const offering = await this.findBySlug(slug);
    if (!offering) throw new NotFoundException(`Class ${slug} not found`);
    return offering;
  }

  /** Upcoming occurrences with confirmed reservations subtracted. */
  async availability(id: string, days: number): Promise<ClassOccurrence[]> {
    const offering = await this.getOrThrow(id);
    return this.availabilityFor(offering, days);
  }

  async discover(params: DiscoverQuery): Promise<DiscoverClassDto[]> {
    const offerings = await this.classes.find({ order: { createdAt: 'ASC' } });
    const normalized = params.query?.trim().toLowerCase() ?? '';
    const radius = params.radiusMeters ?? 5000;
    const results = await Promise.all(offerings.map(async (offering): Promise<DiscoverClassDto | null> => {
      const dto = offering.toDto();
      const haystack = `${dto.activity} ${dto.description ?? ''} ${dto.category}`.toLowerCase();
      if (normalized && !haystack.includes(normalized)) return null;
      const distanceMeters = params.origin && dto.location
        ? haversineMeters(params.origin, dto.location)
        : null;
      if (distanceMeters !== null && distanceMeters > radius) return null;
      const occurrences = await this.availabilityFor(offering, params.days ?? 21);
      const nextOccurrence: ClassOccurrence | null = occurrences.find((item) => item.seatsAvailable > 0) ?? occurrences[0] ?? null;
      return { ...dto, distanceMeters, nextOccurrence };
    }));
    return results
      .filter((item): item is DiscoverClassDto => item !== null)
      .sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER));
  }

  /** Locks the offering row before calculating and writing capacity. */
  reserve(userId: string, classId: string, dto: ReserveClassDto): Promise<ClassReservation> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const classes = manager.getRepository(ClassOffering);
      const reservations = manager.getRepository(ClassReservation);
      const offering = await classes.findOne({ where: { id: classId }, lock: { mode: 'pessimistic_write' } });
      if (!offering) throw new NotFoundException(`Class ${classId} not found`);

      const occurrenceStart = new Date(dto.occurrenceStart);
      const validOccurrence = generateOccurrences(offering.timings ?? [], offering.durationMinutes, offering.seats, { days: 90 })
        .some((item) => item.start === occurrenceStart.toISOString());
      if (!validOccurrence) throw new BadRequestException('The selected class occurrence is no longer available');

      const existing = await reservations.findOne({
        where: { userId, classId, occurrenceStart, status: ReservationStatus.RESERVED },
      });
      if (existing) return existing;

      const raw = await reservations.createQueryBuilder('reservation')
        .select('COALESCE(SUM(reservation.seats), 0)', 'reserved')
        .where('reservation.class_id = :classId', { classId })
        .andWhere('reservation.occurrence_start = :occurrenceStart', { occurrenceStart })
        .andWhere('reservation.status = :status', { status: ReservationStatus.RESERVED })
        .getRawOne<{ reserved: string }>();
      const reserved = Number(raw?.reserved ?? 0);
      if (reserved + dto.seats > offering.seats) {
        throw new ConflictException('Not enough seats remain for this class');
      }

      return reservations.save(reservations.create({
        classId,
        userId,
        occurrenceStart,
        seats: dto.seats,
        status: ReservationStatus.RESERVED,
      }));
    });
  }

  cancelReservation(userId: string, classId: string, reservationId: string): Promise<ClassReservation> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const reservations = manager.getRepository(ClassReservation);
      const reservation = await reservations.findOne({
        where: { id: reservationId, classId, userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reservation) throw new NotFoundException(`Reservation ${reservationId} not found`);
      if (reservation.status === ReservationStatus.CANCELLED) return reservation;
      reservation.status = ReservationStatus.CANCELLED;
      return reservations.save(reservation);
    });
  }

  private async availabilityFor(offering: ClassOffering, days: number): Promise<ClassOccurrence[]> {
    const from = new Date();
    const horizon = new Date(from.getTime() + days * 86_400_000);
    const rows = await this.reservations.find({
      where: {
        classId: offering.id,
        status: ReservationStatus.RESERVED,
        occurrenceStart: Between(from, horizon),
      },
    });
    const reservedByStart = new Map<string, number>();
    for (const row of rows) {
      const key = row.occurrenceStart.toISOString();
      reservedByStart.set(key, (reservedByStart.get(key) ?? 0) + row.seats);
    }
    return generateOccurrences(offering.timings ?? [], offering.durationMinutes, offering.seats, {
      from,
      days,
      seatsAvailable: (start) => Math.max(0, offering.seats - (reservedByStart.get(start.toISOString()) ?? 0)),
    });
  }
}

function haversineMeters(a: GeoLocation, b: GeoLocation): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
