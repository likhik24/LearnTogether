import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  AvailabilityDay,
  ChildAgeGroup,
  ProviderCategory,
  SessionFrequency,
  TimeSlot,
  TravelRadius,
  VerificationStatus,
} from '@learn-and-build/types';
import { TeachersService } from './teachers.service';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherDocument } from './entities/teacher-document.entity';
import { TeacherModerationAudit } from './entities/teacher-moderation-audit.entity';

function makeProfile(overrides: Partial<TeacherProfile> = {}): TeacherProfile {
  const p = new TeacherProfile();
  Object.assign(
    p,
    {
      id: 'p-1',
      userId: 'u-1',
      displayName: 'Tess',
      bio: null,
      subjects: [],
      location: null,
      verificationStatus: VerificationStatus.PENDING,
      rejectionReason: null,
      phone: '9000000000',
      email: 'tess@example.com',
      locality: 'Hitech City',
      city: 'Hyderabad',
      category: ProviderCategory.STEM,
      skills: ['Robotics'],
      skillDescription: 'Hands-on robotics projects.',
      whyJoin: 'I enjoy helping children build things.',
      documents: [],
    },
    overrides,
  );
  return p;
}

describe('TeachersService verification flow', () => {
  let profiles: jest.Mocked<Pick<Repository<TeacherProfile>, 'findOne' | 'save'>>;
  let documents: jest.Mocked<Pick<Repository<TeacherDocument>, 'save' | 'create'>>;
  let audits: jest.Mocked<Pick<Repository<TeacherModerationAudit>, 'save' | 'create'>>;
  let service: TeachersService;
  const db = { query: jest.fn().mockResolvedValue([]) };

  beforeEach(() => {
    profiles = { findOne: jest.fn(), save: jest.fn() };
    documents = { save: jest.fn(), create: jest.fn() };
    audits = { save: jest.fn(), create: jest.fn() };
    audits.create.mockImplementation((value) => Object.assign(new TeacherModerationAudit(), value));
    audits.save.mockImplementation(async (value) => value as TeacherModerationAudit);
    profiles.save.mockImplementation(async (p) => p as TeacherProfile);
    service = new TeachersService(
      profiles as unknown as Repository<TeacherProfile>,
      documents as unknown as Repository<TeacherDocument>,
      audits as unknown as Repository<TeacherModerationAudit>,
      db as unknown as DataSource,
    );
  });

  it('blocks submission when no documents are uploaded', async () => {
    profiles.findOne.mockResolvedValue(makeProfile({ documents: [] }));
    await expect(service.submitForReview('u-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks submission when required onboarding answers are incomplete', async () => {
    profiles.findOne.mockResolvedValue(
      makeProfile({ phone: null, documents: [new TeacherDocument()] }),
    );
    await expect(service.submitForReview('u-1')).rejects.toThrow('phone number');
  });

  it('moves PENDING -> SUBMITTED when a document exists', async () => {
    const doc = new TeacherDocument();
    profiles.findOne.mockResolvedValue(makeProfile({ documents: [doc] }));
    const result = await service.submitForReview('u-1');
    expect(result.verificationStatus).toBe(VerificationStatus.SUBMITTED);
  });

  it('approves a SUBMITTED profile', async () => {
    profiles.findOne.mockResolvedValue(
      makeProfile({ verificationStatus: VerificationStatus.SUBMITTED }),
    );
    const result = await service.approve('p-1', 'admin-1');
    expect(result.verificationStatus).toBe(VerificationStatus.APPROVED);
  });

  it('rejects an invalid transition with 409 Conflict', async () => {
    profiles.findOne.mockResolvedValue(
      makeProfile({ verificationStatus: VerificationStatus.PENDING }),
    );
    await expect(service.approve('p-1', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('records a rejection reason', async () => {
    profiles.findOne.mockResolvedValue(
      makeProfile({ verificationStatus: VerificationStatus.UNDER_REVIEW }),
    );
    const result = await service.reject('p-1', 'admin-1', 'Blurry ID document');
    expect(result.verificationStatus).toBe(VerificationStatus.REJECTED);
    expect(result.rejectionReason).toBe('Blurry ID document');
    expect(audits.save).toHaveBeenCalled();
  });
});

describe('TeachersService.upsertProfile provider onboarding', () => {
  let profiles: jest.Mocked<Pick<Repository<TeacherProfile>, 'findOne' | 'save' | 'create'>>;
  let documents: jest.Mocked<Pick<Repository<TeacherDocument>, 'save' | 'create'>>;
  let audits: jest.Mocked<Pick<Repository<TeacherModerationAudit>, 'save' | 'create'>>;
  let service: TeachersService;
  const db = { query: jest.fn().mockResolvedValue([]) };

  beforeEach(() => {
    profiles = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
    documents = { save: jest.fn(), create: jest.fn() };
    audits = { save: jest.fn(), create: jest.fn() };
    audits.create.mockImplementation((value) => Object.assign(new TeacherModerationAudit(), value));
    audits.save.mockImplementation(async (value) => value as TeacherModerationAudit);
    profiles.create.mockImplementation((p) => Object.assign(new TeacherProfile(), p));
    profiles.save.mockImplementation(async (p) => p as TeacherProfile);
    service = new TeachersService(
      profiles as unknown as Repository<TeacherProfile>,
      documents as unknown as Repository<TeacherDocument>,
      audits as unknown as Repository<TeacherModerationAudit>,
      db as unknown as DataSource,
    );
  });

  it('persists category, subcategories and availability on a new profile', async () => {
    profiles.findOne.mockResolvedValue(null);
    const result = await service.upsertProfile('u-9', {
      displayName: 'Chitra',
      phone: '+91 90000 00000',
      email: 'chitra@example.com',
      category: ProviderCategory.MUSIC,
      subcategories: ['Carnatic music'],
      skills: ['Carnatic music', 'Storytelling'],
      childAgeGroups: [ChildAgeGroup.G_4_6, ChildAgeGroup.G_6_8],
      availableDays: [AvailabilityDay.SATURDAY, AvailabilityDay.SUNDAY],
      timeSlots: [TimeSlot.S_9_11],
      travelRadius: TravelRadius.WITHIN_5KM,
      sessionFrequency: SessionFrequency.WEEKENDS_ONLY,
      whyJoin: 'I love sharing music with children.',
    });
    expect(result.category).toBe(ProviderCategory.MUSIC);
    expect(result.subcategories).toEqual(['Carnatic music']);
    expect(result.availableDays).toEqual([AvailabilityDay.SATURDAY, AvailabilityDay.SUNDAY]);
    expect(result.travelRadius).toBe(TravelRadius.WITHIN_5KM);
    expect(result.whyJoin).toBe('I love sharing music with children.');
  });

  it('preserves earlier answers when a later save omits them', async () => {
    profiles.findOne.mockResolvedValue(
      makeProfile({
        category: ProviderCategory.MUSIC,
        subcategories: ['Carnatic music'],
      }),
    );
    const result = await service.upsertProfile('u-1', {
      displayName: 'Tess',
      city: 'Hyderabad',
    });
    expect(result.city).toBe('Hyderabad');
    // Untouched fields survive the partial update.
    expect(result.category).toBe(ProviderCategory.MUSIC);
    expect(result.subcategories).toEqual(['Carnatic music']);
  });
});
