import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VerificationStatus } from '@learn-and-build/types';
import { TeachersService } from './teachers.service';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherDocument } from './entities/teacher-document.entity';

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
      documents: [],
    },
    overrides,
  );
  return p;
}

describe('TeachersService verification flow', () => {
  let profiles: jest.Mocked<Pick<Repository<TeacherProfile>, 'findOne' | 'save'>>;
  let documents: jest.Mocked<Pick<Repository<TeacherDocument>, 'save' | 'create'>>;
  let service: TeachersService;

  beforeEach(() => {
    profiles = { findOne: jest.fn(), save: jest.fn() };
    documents = { save: jest.fn(), create: jest.fn() };
    profiles.save.mockImplementation(async (p) => p as TeacherProfile);
    service = new TeachersService(
      profiles as unknown as Repository<TeacherProfile>,
      documents as unknown as Repository<TeacherDocument>,
    );
  });

  it('blocks submission when no documents are uploaded', async () => {
    profiles.findOne.mockResolvedValue(makeProfile({ documents: [] }));
    await expect(service.submitForReview('u-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
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
    const result = await service.approve('p-1');
    expect(result.verificationStatus).toBe(VerificationStatus.APPROVED);
  });

  it('rejects an invalid transition with 409 Conflict', async () => {
    profiles.findOne.mockResolvedValue(
      makeProfile({ verificationStatus: VerificationStatus.PENDING }),
    );
    await expect(service.approve('p-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('records a rejection reason', async () => {
    profiles.findOne.mockResolvedValue(
      makeProfile({ verificationStatus: VerificationStatus.UNDER_REVIEW }),
    );
    const result = await service.reject('p-1', 'Blurry ID document');
    expect(result.verificationStatus).toBe(VerificationStatus.REJECTED);
    expect(result.rejectionReason).toBe('Blurry ID document');
  });
});
