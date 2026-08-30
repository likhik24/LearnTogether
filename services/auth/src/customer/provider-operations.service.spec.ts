import { ConflictException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { BookingStatus, PaymentStatus } from '@learn-and-build/types';
import { ProviderOperationsService } from './provider-operations.service';
import { Booking } from './entities/booking.entity';
import { ClassReview } from './entities/class-review.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import type { PaymentsGateway } from './payments.gateway';

describe('ProviderOperationsService', () => {
  const bookings = { update: jest.fn() };
  const reviews = {
    findOne: jest.fn(),
    create: jest.fn((value) => Object.assign(new ClassReview(), value)),
    save: jest.fn(async (value: ClassReview) => value),
  };
  const notifications = {
    create: jest.fn((value) => Object.assign(new CustomerNotification(), value)),
    save: jest.fn(async (value: CustomerNotification) => value),
  };
  const db = { query: jest.fn(), transaction: jest.fn() };
  const payments = { refundBooking: jest.fn() };
  let service: ProviderOperationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProviderOperationsService(
      bookings as unknown as Repository<Booking>,
      reviews as unknown as Repository<ClassReview>,
      notifications as unknown as Repository<CustomerNotification>,
      db as unknown as DataSource,
      payments as unknown as PaymentsGateway,
    );
  });

  it('returns only the class owner roster and serializes its session time', async () => {
    const start = new Date('2026-09-05T05:00:00.000Z');
    db.query
      .mockResolvedValueOnce([
        {
          id: 'class-1',
          teacher_id: 'teacher-1',
          activity: 'Robotics',
          duration_minutes: 60,
          seats: 8,
          timings: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          bookingId: 'booking-1',
          classId: 'class-1',
          parentName: 'Parent',
          parentEmail: 'parent@example.com',
          childId: 'child-1',
          childName: 'Asha',
          scheduledStart: start,
          bookingStatus: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.SUCCEEDED,
          attendanceStatus: null,
          attendanceNotes: null,
        },
      ]);

    const result = await service.roster('teacher-1', 'class-1', start.toISOString());

    expect(result[0].scheduledStart).toBe(start.toISOString());
    expect(result[0].parentEmail).toBe('parent@example.com');
  });

  it('does not allow a review until a confirmed class has ended', async () => {
    db.query.mockResolvedValueOnce([
      {
        class_ref: 'class-1',
        scheduled_start: new Date(Date.now() + 60_000),
        duration_minutes: 60,
        parent_name: 'Parent',
        teacher_id: 'teacher-1',
        activity: 'Robotics',
      },
    ]);

    await expect(service.reviewBooking('user-1', 'booking-1', 5)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(reviews.save).not.toHaveBeenCalled();
  });

  it('publishes a review tied to a completed booking and notifies the provider', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          class_ref: 'class-1',
          scheduled_start: new Date(Date.now() - 2 * 60 * 60_000),
          duration_minutes: 60,
          parent_name: 'Parent',
          teacher_id: 'teacher-1',
          activity: 'Robotics',
        },
      ])
      .mockResolvedValueOnce([]);
    reviews.findOne.mockResolvedValue(null);
    reviews.save.mockImplementationOnce(async (value: ClassReview) =>
      Object.assign(value, {
        id: 'review-1',
        createdAt: new Date('2026-08-30T10:00:00.000Z'),
        updatedAt: new Date('2026-08-30T10:00:00.000Z'),
      }),
    );

    const result = await service.reviewBooking('user-1', 'booking-1', 5, 'Wonderful class');

    expect(result).toEqual(expect.objectContaining({ rating: 5, comment: 'Wonderful class' }));
    expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE class_offerings'), [
      'class-1',
    ]);
    expect(notifications.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'teacher-1', kind: 'review' }),
    );
  });
});
