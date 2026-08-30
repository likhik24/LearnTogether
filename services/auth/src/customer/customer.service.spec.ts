import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@learn-and-build/types';
import type { ObjectLiteral, Repository } from 'typeorm';
import { CustomerService } from './customer.service';
import { Booking } from './entities/booking.entity';
import { ChildProfile } from './entities/child-profile.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { SavedClass } from './entities/saved-class.entity';
import { SchedulingGateway } from './scheduling.gateway';

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
  let scheduling: jest.Mocked<Pick<SchedulingGateway, 'getClass' | 'reserve' | 'release'>>;
  let service: CustomerService;

  beforeEach(() => {
    children = repository();
    saved = repository();
    bookings = repository();
    notifications = repository();
    scheduling = { getClass: jest.fn(), reserve: jest.fn(), release: jest.fn() };
    service = new CustomerService(
      children as unknown as Repository<ChildProfile>,
      saved as unknown as Repository<SavedClass>,
      bookings as unknown as Repository<Booking>,
      notifications as unknown as Repository<CustomerNotification>,
      scheduling as unknown as SchedulingGateway,
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

    await expect(service.saveClass('user-1', 'Bearer token', 'build-a-car')).resolves.toBe(existing);
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
    children.findOne.mockResolvedValue(Object.assign(new ChildProfile(), { id: 'child-1' }));
    scheduling.getClass.mockResolvedValue({
      id: 'class-1',
      slug: 'build-a-car',
      activity: 'Build a Car',
      priceMinor: 49900,
      currency: 'INR',
    } as never);
    const booking = Object.assign(new Booking(), {
      id: 'booking-1',
      userId: 'user-1',
      reservationId: 'reservation-1',
      status: BookingStatus.CONFIRMED,
    });
    bookings.create.mockReturnValue(booking);
    bookings.save.mockResolvedValue(booking);
    notifications.create.mockImplementation((value) => value as CustomerNotification);
    notifications.save.mockImplementation(async (value) => value as CustomerNotification);
    scheduling.reserve.mockResolvedValue({ id: 'reservation-1' } as never);
    scheduling.release.mockResolvedValue({ id: 'reservation-1' } as never);

    await service.createBooking('user-1', 'Bearer token', {
      classRef: 'class-1',
      title: 'Build a Car',
      scheduledStart: '2026-08-29T05:00:00.000Z',
      amountMinor: 49900,
      currency: 'INR',
    });
    bookings.findOne.mockResolvedValue(booking);
    await service.cancelBooking('user-1', 'Bearer token', 'booking-1');

    expect(booking.status).toBe(BookingStatus.CANCELLED);
    expect(scheduling.reserve).toHaveBeenCalledTimes(1);
    expect(scheduling.release).toHaveBeenCalledTimes(1);
    expect(notifications.save).toHaveBeenCalledTimes(2);
  });

  it('rejects a booking when the parent has no child profile', async () => {
    children.findOne.mockResolvedValue(null);

    await expect(service.createBooking('user-1', 'Bearer token', {
      classRef: 'class-1',
      title: 'Build a Car',
      scheduledStart: '2026-08-29T05:00:00.000Z',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(scheduling.getClass).not.toHaveBeenCalled();
    expect(scheduling.reserve).not.toHaveBeenCalled();
  });

  it('marks all unread notifications as read', async () => {
    notifications.update.mockResolvedValue({ affected: 2, generatedMaps: [], raw: [] });
    await service.markAllNotificationsRead('user-1');
    expect(notifications.update).toHaveBeenCalledTimes(1);
  });
});
