import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@learn-and-build/types';
import type { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { CustomerService } from './customer.service';
import { Booking } from './entities/booking.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { SavedClass } from './entities/saved-class.entity';
import { SchedulingGateway } from './scheduling.gateway';
import { PaymentsGateway } from './payments.gateway';
import { ClassWaitlist } from './entities/class-waitlist.entity';
import { BookingRescheduleRequest } from './entities/booking-reschedule-request.entity';

type Repo<T extends ObjectLiteral> = jest.Mocked<
  Pick<Repository<T>, 'create' | 'save' | 'find' | 'findOne' | 'delete' | 'update'>
>;

function repository<T extends ObjectLiteral>(): Repo<T> {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  } as unknown as Repo<T>;
}

describe('CustomerService', () => {
  let children: Repo<ChildProfile>;
  let saved: Repo<SavedClass>;
  let bookings: Repo<Booking>;
  let notifications: Repo<CustomerNotification>;
  let waitlists: Repo<ClassWaitlist>;
  let reschedules: Repo<BookingRescheduleRequest>;
  let scheduling: jest.Mocked<Pick<SchedulingGateway, 'getClass' | 'reserve' | 'release'>>;
  let payments: jest.Mocked<Pick<PaymentsGateway, 'assertReady'>>;
  let service: CustomerService;
  const manager = {
    query: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (value: unknown) => value),
  };
  const db = {
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    children = repository();
    saved = repository();
    bookings = repository();
    notifications = repository();
    waitlists = repository();
    reschedules = repository();
    scheduling = { getClass: jest.fn(), reserve: jest.fn(), release: jest.fn() };
    payments = { assertReady: jest.fn().mockResolvedValue(undefined) };
    service = new CustomerService(
      children as unknown as Repository<ChildProfile>,
      saved as unknown as Repository<SavedClass>,
      bookings as unknown as Repository<Booking>,
      notifications as unknown as Repository<CustomerNotification>,
      waitlists as unknown as Repository<ClassWaitlist>,
      reschedules as unknown as Repository<BookingRescheduleRequest>,
      scheduling as unknown as SchedulingGateway,
      payments as unknown as PaymentsGateway,
      db as unknown as DataSource,
    );
  });

  it('creates an owned child profile and a welcome notification', async () => {
    const child = Object.assign(new ChildProfile(), {
      id: 'child-1',
      userId: 'user-1',
      name: 'Abhiram',
    });
    children.create.mockReturnValue(child);
    children.save.mockResolvedValue(child);
    notifications.create.mockImplementation((value) => value as CustomerNotification);
    notifications.save.mockImplementation(async (value) => value as CustomerNotification);

    const result = await service.createChild('user-1', { name: 'Abhiram', interests: ['STEM'] });

    expect(result).toBe(child);
    expect(children.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', interests: ['STEM'] }),
    );
    expect(notifications.save).toHaveBeenCalledTimes(1);
  });

  it('saves a class idempotently for a user', async () => {
    const existing = Object.assign(new SavedClass(), {
      id: 'saved-1',
      userId: 'user-1',
      classRef: 'build-a-car',
    });
    saved.findOne.mockResolvedValue(existing);

    await expect(service.saveClass('user-1', 'Bearer token', 'build-a-car')).resolves.toBe(
      existing,
    );
    expect(saved.save).not.toHaveBeenCalled();
  });

  it('uses the authoritative class title when saving a class', async () => {
    saved.findOne.mockResolvedValue(null);
    scheduling.getClass.mockResolvedValue({ activity: 'Authoritative title' } as never);
    saved.create.mockImplementation((value) => value as SavedClass);
    saved.save.mockImplementation(async (value) => value as SavedClass);

    const result = await service.saveClass('user-1', 'Bearer token', 'build-a-car');

    expect(result.title).toBe('Authoritative title');
    expect(scheduling.getClass).toHaveBeenCalledWith('Bearer token', 'build-a-car');
  });

  it('does not update a child belonging to another user', async () => {
    children.findOne.mockResolvedValue(null);
    await expect(service.updateChild('user-1', 'child-2', { name: 'Nope' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates and cancels a booking', async () => {
    children.find.mockResolvedValue([
      Object.assign(new ChildProfile(), { id: 'child-1', name: 'Asha', birthDate: '2021-06-10' }),
    ]);
    scheduling.getClass.mockResolvedValue({
      id: 'class-1',
      slug: 'build-a-car',
      activity: 'Build a Car',
      priceMinor: 49900,
      currency: 'INR',
      ageMin: 4,
      ageMax: 8,
    } as never);
    const booking = Object.assign(new Booking(), {
      id: 'booking-1',
      userId: 'user-1',
      reservationId: 'reservation-1',
      scheduledStart: new Date(Date.now() + 86_400_000),
      status: BookingStatus.CONFIRMED,
    });
    bookings.create.mockReturnValue(booking);
    bookings.save.mockResolvedValue(booking);
    notifications.create.mockImplementation((value) => value as CustomerNotification);
    notifications.save.mockImplementation(async (value) => value as CustomerNotification);
    scheduling.reserve.mockResolvedValue({ id: 'reservation-1' } as never);
    scheduling.release.mockResolvedValue({ id: 'reservation-1' } as never);

    await service.createBooking('user-1', 'Bearer token', {
      childId: 'child-1',
      classRef: 'class-1',
      title: 'Build a Car',
      scheduledStart: '2026-08-29T05:00:00.000Z',
      amountMinor: 49900,
      currency: 'INR',
    });
    bookings.findOne.mockResolvedValue(booking);
    manager.save.mockImplementation(async (value) => value);
    await service.cancelBooking('user-1', 'Bearer token', 'booking-1');

    expect(booking.status).toBe(BookingStatus.CANCELLED);
    expect(scheduling.reserve).toHaveBeenCalledTimes(1);
    expect(scheduling.release).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES ('refund_booking'"),
      ['booking-1'],
    );
  });

  it('rejects a booking when the parent has no child profile', async () => {
    children.find.mockResolvedValue([]);

    await expect(
      service.createBooking('user-1', 'Bearer token', {
        childId: 'child-1',
        classRef: 'class-1',
        title: 'Build a Car',
        scheduledStart: '2026-08-29T05:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(scheduling.getClass).not.toHaveBeenCalled();
    expect(scheduling.reserve).not.toHaveBeenCalled();
  });

  it('reserves and prices one seat per eligible sibling', async () => {
    const siblings = [
      Object.assign(new ChildProfile(), {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Asha',
        birthDate: '2022-06-10',
      }),
      Object.assign(new ChildProfile(), {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Arun',
        birthDate: '2022-02-10',
      }),
    ];
    children.find.mockResolvedValue(siblings);
    bookings.findOne.mockResolvedValue(null);
    scheduling.getClass.mockResolvedValue({
      id: 'class-1',
      slug: 'robotics',
      activity: 'Robotics',
      priceMinor: 50000,
      currency: 'INR',
      ageMin: 4,
      ageMax: 10,
    } as never);
    scheduling.reserve.mockResolvedValue({ id: 'reservation-1' } as never);
    bookings.create.mockImplementation((value) => Object.assign(new Booking(), value));
    manager.save.mockImplementation(async (value) =>
      Object.assign(new Booking(), value, { id: 'booking-1' }),
    );
    notifications.create.mockImplementation((value) => value as CustomerNotification);
    notifications.save.mockImplementation(async (value) => value as CustomerNotification);

    const booking = await service.createBooking('user-1', 'Bearer token', {
      childId: siblings[0].id,
      childIds: siblings.map((item) => item.id),
      classRef: 'class-1',
      title: 'Ignored',
      scheduledStart: '2031-08-29T05:00:00.000Z',
    });

    expect(scheduling.reserve).toHaveBeenCalledWith(
      'Bearer token',
      'class-1',
      '2031-08-29T05:00:00.000Z',
      2,
    );
    expect(booking).toEqual(
      expect.objectContaining({ seatCount: 2, amountMinor: 100000, childName: 'Asha, Arun' }),
    );
  });

  it('rejects a booking when the selected child is outside the class age range', async () => {
    children.find.mockResolvedValue([
      Object.assign(new ChildProfile(), {
        id: 'child-1',
        name: 'Asha',
        birthDate: '2024-06-10',
      }),
    ]);
    scheduling.getClass.mockResolvedValue({ ageMin: 6, ageMax: 9 } as never);

    await expect(
      service.createBooking('user-1', 'Bearer token', {
        childId: 'child-1',
        classRef: 'class-1',
        title: 'Build a Car',
        scheduledStart: '2026-08-29T05:00:00.000Z',
      }),
    ).rejects.toThrow('this class is for ages 6–9');
    expect(scheduling.reserve).not.toHaveBeenCalled();
  });

  it('requires a birthday before making an age-checked booking', async () => {
    children.find.mockResolvedValue([
      Object.assign(new ChildProfile(), {
        id: 'child-1',
        name: 'Asha',
        birthDate: null,
      }),
    ]);

    await expect(
      service.createBooking('user-1', 'Bearer token', {
        childId: 'child-1',
        classRef: 'class-1',
        title: 'Build a Car',
        scheduledStart: '2026-08-29T05:00:00.000Z',
      }),
    ).rejects.toThrow('birthday');
    expect(scheduling.getClass).not.toHaveBeenCalled();
  });

  it('marks all unread notifications as read', async () => {
    notifications.update.mockResolvedValue({ affected: 2, generatedMaps: [], raw: [] });
    await service.markAllNotificationsRead('user-1');
    expect(notifications.update).toHaveBeenCalledTimes(1);
  });

  it('schedules account deletion with a cancellable seven-day grace period', async () => {
    const requestedAt = new Date('2031-08-29T05:00:00.000Z');
    db.query
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ deletion_requested_at: requestedAt }]);

    const status = await service.requestAccountDeletion('user-1');

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES ('delete_account'"),
      ['user-1'],
    );
    expect(status).toEqual({
      requestedAt: requestedAt.toISOString(),
      scheduledFor: '2031-09-05T05:00:00.000Z',
    });
  });
});
