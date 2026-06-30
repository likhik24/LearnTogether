import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationStatus } from '@learn-and-build/types';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherDocument } from './entities/teacher-document.entity';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { ConfirmDocumentDto } from './dto/confirm-document.dto';
import {
  assertTransition,
  InvalidVerificationTransitionError,
} from '../verification/verification';

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(TeacherProfile)
    private readonly profiles: Repository<TeacherProfile>,
    @InjectRepository(TeacherDocument)
    private readonly documents: Repository<TeacherDocument>,
  ) {}

  /** Applies a state-machine transition, mapping invalid ones to HTTP 409. */
  private transition(
    from: VerificationStatus,
    to: VerificationStatus,
  ): VerificationStatus {
    try {
      return assertTransition(from, to);
    } catch (err) {
      if (err instanceof InvalidVerificationTransitionError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
  }

  findByUserId(userId: string): Promise<TeacherProfile | null> {
    return this.profiles.findOne({ where: { userId } });
  }

  async getByUserIdOrThrow(userId: string): Promise<TeacherProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Teacher profile not found');
    }
    return profile;
  }

  findById(id: string): Promise<TeacherProfile | null> {
    return this.profiles.findOne({ where: { id } });
  }

  async upsertProfile(
    userId: string,
    dto: UpsertProfileDto,
  ): Promise<TeacherProfile> {
    let profile = await this.findByUserId(userId);
    if (!profile) {
      profile = this.profiles.create({
        userId,
        verificationStatus: VerificationStatus.PENDING,
        subjects: [],
      });
    }
    profile.displayName = dto.displayName;
    profile.bio = dto.bio ?? profile.bio ?? null;
    profile.subjects = dto.subjects ?? profile.subjects ?? [];
    if (dto.location) {
      // PostGIS geography point stores coordinates as [lng, lat].
      profile.location = {
        type: 'Point',
        coordinates: [dto.location.lng, dto.location.lat],
      };
    }
    return this.profiles.save(profile);
  }

  async addDocument(
    userId: string,
    dto: ConfirmDocumentDto,
  ): Promise<TeacherProfile> {
    const profile = await this.getByUserIdOrThrow(userId);
    const doc = this.documents.create({
      profile,
      type: dto.type,
      fileName: dto.fileName,
      storageKey: dto.storageKey,
    });
    await this.documents.save(doc);
    return this.getByUserIdOrThrow(userId);
  }

  /** Finds APPROVED teachers within radiusMeters of a point, nearest first. */
  async findNearby(
    lat: number,
    lng: number,
    radiusMeters: number,
  ): Promise<TeacherProfile[]> {
    return this.profiles
      .createQueryBuilder('t')
      .where('t.verificationStatus = :status', {
        status: VerificationStatus.APPROVED,
      })
      .andWhere(
        'ST_DWithin(t.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
        { lat, lng, radius: radiusMeters },
      )
      .orderBy(
        'ST_Distance(t.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)',
        'ASC',
      )
      .getMany();
  }

  /** Teacher submits their profile for review (PENDING/REJECTED -> SUBMITTED). */
  async submitForReview(userId: string): Promise<TeacherProfile> {
    const profile = await this.getByUserIdOrThrow(userId);
    if ((profile.documents ?? []).length === 0) {
      throw new BadRequestException(
        'At least one document is required before submitting for review',
      );
    }
    profile.verificationStatus = this.transition(
      profile.verificationStatus,
      VerificationStatus.SUBMITTED,
    );
    profile.rejectionReason = null;
    return this.profiles.save(profile);
  }

  /** Admin moves a submitted profile into review. */
  async startReview(profileId: string): Promise<TeacherProfile> {
    return this.applyTransition(profileId, VerificationStatus.UNDER_REVIEW);
  }

  /** Admin approves a profile. */
  async approve(profileId: string): Promise<TeacherProfile> {
    return this.applyTransition(profileId, VerificationStatus.APPROVED);
  }

  /** Admin rejects a profile with an optional reason. */
  async reject(profileId: string, reason?: string): Promise<TeacherProfile> {
    return this.applyTransition(
      profileId,
      VerificationStatus.REJECTED,
      reason ?? null,
    );
  }

  listByStatus(status: VerificationStatus): Promise<TeacherProfile[]> {
    return this.profiles.find({
      where: { verificationStatus: status },
      order: { updatedAt: 'DESC' },
    });
  }

  private async applyTransition(
    profileId: string,
    to: VerificationStatus,
    rejectionReason: string | null = null,
  ): Promise<TeacherProfile> {
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new NotFoundException('Teacher profile not found');
    }
    profile.verificationStatus = this.transition(
      profile.verificationStatus,
      to,
    );
    if (to === VerificationStatus.REJECTED) {
      profile.rejectionReason = rejectionReason;
    }
    return this.profiles.save(profile);
  }
}
