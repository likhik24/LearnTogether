import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import {
  ClassModerationStatus,
  ClassOfferingStatus,
  OccurrenceStatus,
  ReservationStatus,
  type ClassOccurrence,
  type PublicClassReviewDto,
  type DiscoverClassDto,
  type GeoLocation,
} from '@learn-and-build/types';
import { ClassOffering } from './class-offering.entity';
import { ClassReservation } from './class-reservation.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { ReserveClassDto } from './dto/reserve-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassModerationAudit } from './moderation-audit.entity';
import { assertValidTimings, generateOccurrences } from './timing';

interface DiscoverQuery {
  query?: string;
  origin?: GeoLocation;
  radiusMeters?: number;
  days?: number;
}

interface OccurrenceOverrideRow {
  original_start: Date;
  replacement_start: Date | null;
  status: OccurrenceStatus;
}

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(ClassOffering)
    private readonly classes: Repository<ClassOffering>,
    @InjectRepository(ClassReservation)
    private readonly reservations: Repository<ClassReservation>,
    @InjectRepository(ClassModerationAudit)
    private readonly audits: Repository<ClassModerationAudit>,
    private readonly dataSource: DataSource,
  ) {}

  async create(teacherId: string, dto: CreateClassDto): Promise<ClassOffering> {
    const profiles = await this.dataSource.query<Array<{ exists: number }>>(
      'SELECT 1 AS exists FROM teacher_profiles WHERE user_id = $1',
      [teacherId],
    );
    if (!profiles.length) {
      throw new ConflictException('Complete your provider profile before creating a class');
    }
    try {
      assertValidTimings(dto.timings, dto.durationMinutes);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid timings');
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
      status: ClassOfferingStatus.ACTIVE,
      moderationStatus: ClassModerationStatus.PENDING,
      moderationReason: null,
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
    const offering = (await this.findBySlug(slug)) ?? (await this.findById(slug));
    if (!offering) throw new NotFoundException(`Class ${slug} not found`);
    return offering;
  }

  async getPublicBySlugOrThrow(slug: string): Promise<ClassOffering> {
    const offering = await this.getBySlugOrThrow(slug);
    if (
      offering.status !== ClassOfferingStatus.ACTIVE ||
      offering.moderationStatus !== ClassModerationStatus.APPROVED
    ) {
      throw new NotFoundException(`Class ${slug} not found`);
    }
    return offering;
  }

  async updateOwned(teacherId: string, id: string, dto: UpdateClassDto): Promise<ClassOffering> {
    const offering = await this.getOwnedOrThrow(teacherId, id);
    const timings = dto.timings ?? offering.timings;
    const duration = dto.durationMinutes ?? offering.durationMinutes;
    try {
      assertValidTimings(timings, duration);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid timings');
    }
    const mutable: Array<keyof UpdateClassDto> = [
      'slug',
      'activity',
      'description',
      'category',
      'ageMin',
      'ageMax',
      'priceMinor',
      'currency',
      'imageUrl',
      'tone',
      'venueName',
      'instructorGender',
      'durationMinutes',
      'seats',
      'timings',
      'location',
    ];
    for (const key of mutable) {
      if (dto[key] === undefined) continue;
      if (key === 'location') {
        offering.location = dto.location
          ? { type: 'Point', coordinates: [dto.location.lng, dto.location.lat] }
          : null;
      } else {
        Object.assign(offering, { [key]: dto[key] });
      }
    }
    offering.moderationStatus = ClassModerationStatus.PENDING;
    offering.moderationReason = null;
    return this.classes.save(offering);
  }

  async setOwnedStatus(
    teacherId: string,
    id: string,
    status: ClassOfferingStatus,
  ): Promise<ClassOffering> {
    const offering = await this.getOwnedOrThrow(teacherId, id);
    offering.status = status;
    return this.classes.save(offering);
  }

  listForModeration(status?: ClassModerationStatus): Promise<ClassOffering[]> {
    return this.classes.find({
      where: status ? { moderationStatus: status } : {},
      order: { updatedAt: 'DESC' },
    });
  }

  async moderate(
    actorId: string,
    id: string,
    status: ClassModerationStatus.APPROVED | ClassModerationStatus.REJECTED,
    reason?: string,
  ): Promise<ClassOffering> {
    const offering = await this.getOrThrow(id);
    if (status === ClassModerationStatus.APPROVED) {
      const rows = await this.dataSource.query<Array<{ verification_status: string }>>(
        'SELECT verification_status FROM teacher_profiles WHERE user_id = $1',
        [offering.teacherId],
      );
      if (rows[0]?.verification_status !== 'approved') {
        throw new ConflictException(
          'The provider must be identity-approved before this class can be approved',
        );
      }
    }
    offering.moderationStatus = status;
    offering.moderationReason = reason?.trim() || null;
    const saved = await this.classes.save(offering);
    await this.audits.save(
      this.audits.create({
        classId: id,
        actorId,
        action: status,
        note: offering.moderationReason,
      }),
    );
    await this.dataSource.query(
      `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
       VALUES ($1, 'moderation', $2, $3, NULL)`,
      [
        offering.teacherId,
        `Class ${status}`,
        status === ClassModerationStatus.APPROVED
          ? `${offering.activity} is approved and visible to families.`
          : `${offering.activity} needs changes.${offering.moderationReason ? ` ${offering.moderationReason}` : ''}`,
      ],
    );
    return saved;
  }

  async reviews(classId: string): Promise<PublicClassReviewDto[]> {
    await this.getPublicBySlugOrThrow(classId);
    const rows = await this.dataSource.query<
      Array<Omit<PublicClassReviewDto, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }>
    >(
      `SELECT r.id, r.class_id AS "classId", u.display_name AS "parentName",
              r.rating, r.comment, r.created_at AS "createdAt", r.updated_at AS "updatedAt"
       FROM class_reviews r JOIN users u ON u.id = r.user_id
       WHERE r.class_id = $1 ORDER BY r.created_at DESC`,
      [classId],
    );
    return rows.map((row) => ({
      ...row,
      parentName: row.parentName.trim().split(/\s+/)[0] || 'Parent',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async moderationHistory() {
    return (await this.audits.find({ order: { createdAt: 'DESC' }, take: 100 })).map((audit) =>
      audit.toDto(),
    );
  }

  /** Upcoming occurrences with confirmed reservations subtracted. */
  async availability(id: string, days: number): Promise<ClassOccurrence[]> {
    const offering = await this.getOrThrow(id);
    if (
      offering.status !== ClassOfferingStatus.ACTIVE ||
      offering.moderationStatus !== ClassModerationStatus.APPROVED
    ) {
      throw new NotFoundException(`Class ${id} not found`);
    }
    return this.availabilityFor(offering, days);
  }

  async discover(params: DiscoverQuery): Promise<DiscoverClassDto[]> {
    const offerings = await this.classes.find({
      where: {
        status: ClassOfferingStatus.ACTIVE,
        moderationStatus: ClassModerationStatus.APPROVED,
      },
      order: { createdAt: 'ASC' },
    });
    const normalized = params.query?.trim().toLowerCase() ?? '';
    const radius = params.radiusMeters ?? 5000;
    const results = await Promise.all(
      offerings.map(async (offering): Promise<DiscoverClassDto | null> => {
        const dto = offering.toDto();
        const haystack = `${dto.activity} ${dto.description ?? ''} ${dto.category}`.toLowerCase();
        if (normalized && !haystack.includes(normalized)) return null;
        const distanceMeters =
          params.origin && dto.location ? haversineMeters(params.origin, dto.location) : null;
        if (distanceMeters !== null && distanceMeters > radius) return null;
        const occurrences = await this.availabilityFor(offering, params.days ?? 21);
        const nextOccurrence: ClassOccurrence | null =
          occurrences.find((item) => item.seatsAvailable > 0) ?? occurrences[0] ?? null;
        return { ...dto, distanceMeters, nextOccurrence };
      }),
    );
    return results
      .filter((item): item is DiscoverClassDto => item !== null)
      .sort(
        (a, b) =>
          (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
          (b.distanceMeters ?? Number.MAX_SAFE_INTEGER),
      );
  }

  /** Locks the offering row before calculating and writing capacity. */
  reserve(userId: string, classId: string, dto: ReserveClassDto): Promise<ClassReservation> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const classes = manager.getRepository(ClassOffering);
      const reservations = manager.getRepository(ClassReservation);
      const offering = await classes.findOne({
        where: { id: classId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!offering) throw new NotFoundException(`Class ${classId} not found`);
      if (
        offering.status !== ClassOfferingStatus.ACTIVE ||
        offering.moderationStatus !== ClassModerationStatus.APPROVED
      ) {
        throw new ConflictException('This class is not currently accepting bookings');
      }

      const occurrenceStart = new Date(dto.occurrenceStart);
      const generated = generateOccurrences(
        offering.timings ?? [],
        offering.durationMinutes,
        offering.seats,
        { days: 90 },
      );
      const overrideRows = await manager.query<OccurrenceOverrideRow[]>(
        `SELECT original_start, replacement_start, status
         FROM class_occurrence_overrides WHERE class_id = $1`,
        [classId],
      );
      const validOccurrence = applyOccurrenceOverrides(
        generated,
        overrideRows,
        offering.durationMinutes,
        offering.seats,
      ).some((item) => item.start === occurrenceStart.toISOString());
      if (!validOccurrence)
        throw new BadRequestException('The selected class occurrence is no longer available');

      const existing = await reservations.findOne({
        where: { userId, classId, occurrenceStart, status: ReservationStatus.RESERVED },
      });
      if (existing) return existing;

      const raw = await reservations
        .createQueryBuilder('reservation')
        .select('COALESCE(SUM(reservation.seats), 0)', 'reserved')
        .where('reservation.class_id = :classId', { classId })
        .andWhere('reservation.occurrence_start = :occurrenceStart', { occurrenceStart })
        .andWhere('reservation.status = :status', { status: ReservationStatus.RESERVED })
        .getRawOne<{ reserved: string }>();
      const reserved = Number(raw?.reserved ?? 0);
      if (reserved + dto.seats > offering.seats) {
        throw new ConflictException('Not enough seats remain for this class');
      }

      return reservations.save(
        reservations.create({
          classId,
          userId,
          occurrenceStart,
          seats: dto.seats,
          status: ReservationStatus.RESERVED,
        }),
      );
    });
  }

  cancelReservation(
    userId: string,
    classId: string,
    reservationId: string,
  ): Promise<ClassReservation> {
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
    const generated = generateOccurrences(offering.timings ?? [], offering.durationMinutes, offering.seats, {
      from,
      days,
      seatsAvailable: (start) =>
        Math.max(0, offering.seats - (reservedByStart.get(start.toISOString()) ?? 0)),
    });
    const overrideRows = await this.dataSource.query<OccurrenceOverrideRow[]>(
      `SELECT original_start, replacement_start, status
       FROM class_occurrence_overrides
       WHERE class_id = $1
         AND (original_start BETWEEN $2 AND $3 OR replacement_start BETWEEN $2 AND $3)`,
      [offering.id, from, horizon],
    );
    return applyOccurrenceOverrides(
      generated,
      overrideRows,
      offering.durationMinutes,
      offering.seats,
    )
      .filter((occurrence) => {
        const start = new Date(occurrence.start);
        return start >= from && start <= horizon;
      })
      .map((occurrence) => ({
        ...occurrence,
        seatsAvailable: Math.max(
          0,
          offering.seats - (reservedByStart.get(occurrence.start) ?? 0),
        ),
      }));
  }

  private async getOwnedOrThrow(teacherId: string, id: string): Promise<ClassOffering> {
    const offering = await this.classes.findOne({ where: { id, teacherId } });
    if (!offering) throw new NotFoundException(`Class ${id} not found`);
    return offering;
  }
}

function applyOccurrenceOverrides(
  occurrences: ClassOccurrence[],
  overrides: OccurrenceOverrideRow[],
  durationMinutes: number,
  seatsTotal: number,
): ClassOccurrence[] {
  const byStart = new Map(overrides.map((item) => [item.original_start.toISOString(), item]));
  const generatedStarts = new Set(occurrences.map((occurrence) => occurrence.start));
  const transformed = occurrences
    .flatMap((occurrence): ClassOccurrence[] => {
      const override = byStart.get(occurrence.start);
      if (!override) return [occurrence];
      if (override.status === OccurrenceStatus.CANCELLED || !override.replacement_start) return [];
      const start = override.replacement_start;
      return [
        {
          ...occurrence,
          start: start.toISOString(),
          end: new Date(start.getTime() + durationMinutes * 60_000).toISOString(),
        },
      ];
    });
  for (const override of overrides) {
    if (
      override.status !== OccurrenceStatus.RESCHEDULED ||
      !override.replacement_start ||
      generatedStarts.has(override.original_start.toISOString())
    ) {
      continue;
    }
    transformed.push({
      start: override.replacement_start.toISOString(),
      end: new Date(
        override.replacement_start.getTime() + durationMinutes * 60_000,
      ).toISOString(),
      seatsTotal,
      seatsAvailable: seatsTotal,
    });
  }
  return [...new Map(transformed.map((item) => [item.start, item])).values()].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
}

function haversineMeters(a: GeoLocation, b: GeoLocation): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
