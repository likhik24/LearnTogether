import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InstructorGender, ReservationStatus } from '@learn-and-build/types';
import { ClassesService } from './classes.service';
import { ClassOffering } from './class-offering.entity';
import { ClassReservation } from './class-reservation.entity';
import { CreateClassDto } from './dto/create-class.dto';

function baseDto(overrides: Partial<CreateClassDto> = {}): CreateClassDto {
  return {
    activity: 'Jiu Jitsu',
    description: 'Beginner friendly',
    instructorGender: InstructorGender.ANY,
    durationMinutes: 60,
    seats: 8,
    timings: [{ weekday: 2, startMinute: 18 * 60 }],
    ...overrides,
  };
}

describe('ClassesService', () => {
  let classes: jest.Mocked<Pick<Repository<ClassOffering>, 'create' | 'save' | 'findOne' | 'find'>>;
  let reservations: jest.Mocked<Pick<Repository<ClassReservation>, 'find'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let service: ClassesService;

  beforeEach(() => {
    classes = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    reservations = { find: jest.fn().mockResolvedValue([]) };
    dataSource = { transaction: jest.fn() };
    classes.create.mockImplementation((value) => Object.assign(new ClassOffering(), value));
    classes.save.mockImplementation(async (value) => value as ClassOffering);
    service = new ClassesService(
      classes as unknown as Repository<ClassOffering>,
      reservations as unknown as Repository<ClassReservation>,
      dataSource as unknown as DataSource,
    );
  });

  it('creates a valid weekday-evening class with customer metadata', async () => {
    const result = await service.create('teacher-1', baseDto({ category: 'Sports', priceMinor: 49900 }));
    expect(result.activity).toBe('Jiu Jitsu');
    expect(result.category).toBe('Sports');
    expect(result.priceMinor).toBe(49900);
    expect(result.teacherId).toBe('teacher-1');
  });

  it('stores location as a GeoJSON point [lng, lat]', async () => {
    const result = await service.create('teacher-1', baseDto({ location: { lat: 12.9, lng: 77.6 } }));
    expect(result.location).toEqual({ type: 'Point', coordinates: [77.6, 12.9] });
  });

  it('rejects a class whose timing falls outside the evening window', async () => {
    await expect(service.create('teacher-1', baseDto({ timings: [{ weekday: 2, startMinute: 9 * 60 }] })))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes availability after subtracting reservations', async () => {
    const now = new Date();
    const daysUntilMonday = (8 - (now.getUTCDay() || 7)) % 7 || 7;
    const occurrenceStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 18));
    const offering = Object.assign(new ClassOffering(), {
      id: 'c-1', seats: 8, durationMinutes: 60, timings: [{ weekday: 1, startMinute: 18 * 60 }],
    });
    classes.findOne.mockResolvedValue(offering);
    reservations.find.mockResolvedValue([Object.assign(new ClassReservation(), { occurrenceStart, seats: 3 })]);
    const occurrences = await service.availability('c-1', 14);
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
    expect(occurrences[0].seatsTotal).toBe(8);
    expect(occurrences[0].seatsAvailable).toBe(5);
  });

  it('rejects a reservation when the locked occurrence is full', async () => {
    const now = new Date();
    const daysUntilMonday = (8 - (now.getUTCDay() || 7)) % 7 || 7;
    const occurrence = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 18));
    const offering = Object.assign(new ClassOffering(), {
      id: 'c-1', seats: 1, durationMinutes: 60, timings: [{ weekday: 1, startMinute: 18 * 60 }],
    });
    const reservationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ reserved: '1' }),
      }),
    };
    const manager = {
      getRepository: jest.fn((entity) => entity === ClassOffering
        ? { findOne: jest.fn().mockResolvedValue(offering) }
        : reservationRepo),
    };
    dataSource.transaction.mockImplementation(async (_isolation, callback) => callback(manager as never));

    await expect(service.reserve('user-1', 'c-1', { occurrenceStart: occurrence.toISOString(), seats: 1 }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('cancels an owned reservation idempotently', async () => {
    const reservation = Object.assign(new ClassReservation(), { status: ReservationStatus.CANCELLED });
    const reservationRepo = { findOne: jest.fn().mockResolvedValue(reservation), save: jest.fn() };
    const manager = { getRepository: jest.fn().mockReturnValue(reservationRepo) };
    dataSource.transaction.mockImplementation(async (_isolation, callback) => callback(manager as never));

    await expect(service.cancelReservation('user-1', 'c-1', 'r-1')).resolves.toBe(reservation);
    expect(reservationRepo.save).not.toHaveBeenCalled();
  });
});
