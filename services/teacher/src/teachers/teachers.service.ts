import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { type PublicTeacherProfileDto, VerificationStatus } from '@learn-and-build/types';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherDocument } from './entities/teacher-document.entity';
import { TeacherModerationAudit } from './entities/teacher-moderation-audit.entity';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { ConfirmDocumentDto } from './dto/confirm-document.dto';
import { assertTransition, InvalidVerificationTransitionError } from '../verification/verification';

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(TeacherProfile)
    private readonly profiles: Repository<TeacherProfile>,
    @InjectRepository(TeacherDocument)
    private readonly documents: Repository<TeacherDocument>,
    @InjectRepository(TeacherModerationAudit)
    private readonly audits: Repository<TeacherModerationAudit>,
    private readonly db: DataSource,
  ) {}

  /** Applies a state-machine transition, mapping invalid ones to HTTP 409. */
  private transition(from: VerificationStatus, to: VerificationStatus): VerificationStatus {
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

  async getPublicProfile(userId: string): Promise<PublicTeacherProfileDto> {
    const profile = await this.profiles.findOne({
      where: { userId, verificationStatus: VerificationStatus.APPROVED },
    });
    if (!profile) throw new NotFoundException('Approved provider profile not found');
    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      bio: profile.bio ?? null,
      subjects: profile.subjects ?? [],
      locality: profile.locality ?? null,
      city: profile.city ?? null,
      skills: profile.skills ?? [],
      skillDescription: profile.skillDescription ?? null,
      yearsExperience: profile.yearsExperience ?? null,
      portfolio: profile.portfolio ?? null,
      instagramUrl: profile.instagramUrl ?? null,
      preplyUrl: profile.preplyUrl ?? null,
      urbanproUrl: profile.urbanproUrl ?? null,
      teacheronUrl: profile.teacheronUrl ?? null,
      verificationStatus: profile.verificationStatus,
    };
  }

  async getDocumentForReview(profileId: string, documentId: string): Promise<TeacherDocument> {
    const profile = await this.findById(profileId);
    const document = profile?.documents?.find((item) => item.id === documentId);
    if (!document) throw new NotFoundException('Teacher document not found');
    return document;
  }

  async upsertProfile(userId: string, dto: UpsertProfileDto): Promise<TeacherProfile> {
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

    // Provider onboarding + availability. Only overwrite when the field is
    // provided so a section-by-section save never clears earlier answers.
    const keep = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

    profile.phone = keep(dto.phone, profile.phone ?? null);
    profile.email = keep(dto.email, profile.email ?? null);
    profile.ageBand = keep(dto.ageBand, profile.ageBand ?? null);
    profile.locality = keep(dto.locality, profile.locality ?? null);
    profile.city = keep(dto.city, profile.city ?? null);
    profile.category = keep(dto.category, profile.category ?? null);
    profile.subcategories = keep(dto.subcategories, profile.subcategories ?? []);
    profile.skills = keep(dto.skills, profile.skills ?? []);
    profile.skillDescription = keep(dto.skillDescription, profile.skillDescription ?? null);
    profile.yearsExperience = keep(dto.yearsExperience, profile.yearsExperience ?? null);
    profile.portfolio = keep(dto.portfolio, profile.portfolio ?? null);
    profile.instagramUrl = keep(dto.instagramUrl, profile.instagramUrl ?? null);
    profile.preplyUrl = keep(dto.preplyUrl, profile.preplyUrl ?? null);
    profile.urbanproUrl = keep(dto.urbanproUrl, profile.urbanproUrl ?? null);
    profile.teacheronUrl = keep(dto.teacheronUrl, profile.teacheronUrl ?? null);
    profile.childrenExperience = keep(dto.childrenExperience, profile.childrenExperience ?? null);
    profile.childrenExperienceDetail = keep(
      dto.childrenExperienceDetail,
      profile.childrenExperienceDetail ?? null,
    );
    profile.childAgeGroups = keep(dto.childAgeGroups, profile.childAgeGroups ?? []);
    profile.teachingFormats = keep(dto.teachingFormats, profile.teachingFormats ?? []);
    profile.venuePreferences = keep(dto.venuePreferences, profile.venuePreferences ?? []);
    profile.travelRadius = keep(dto.travelRadius, profile.travelRadius ?? null);
    profile.homeAddress = keep(dto.homeAddress, profile.homeAddress ?? null);
    profile.availableDays = keep(dto.availableDays, profile.availableDays ?? []);
    profile.timeSlots = keep(dto.timeSlots, profile.timeSlots ?? []);
    profile.availabilityDates = keep(dto.availabilityDates, profile.availabilityDates ?? []);
    profile.preferredAvailability = keep(
      dto.preferredAvailability,
      profile.preferredAvailability ?? null,
    );
    profile.sessionFrequency = keep(dto.sessionFrequency, profile.sessionFrequency ?? null);
    profile.whyJoin = keep(dto.whyJoin, profile.whyJoin ?? null);

    return this.profiles.save(profile);
  }

  async addDocument(userId: string, dto: ConfirmDocumentDto): Promise<TeacherProfile> {
    const profile = await this.getByUserIdOrThrow(userId);
    const doc = this.documents.create({
      profile,
      type: dto.type,
      fileName: dto.fileName,
      storageKey: dto.storageKey,
    });
    await this.documents.save(doc);
    const updated = await this.getByUserIdOrThrow(userId);

    // Automate review: once a document is uploaded, submit the profile for
    // review without a separate manual step — but only when it is awaiting
    // submission (PENDING/REJECTED) and all required fields are present. An
    // incomplete profile is left untouched so the provider can finish it.
    const awaitingSubmission =
      updated.verificationStatus === VerificationStatus.PENDING ||
      updated.verificationStatus === VerificationStatus.REJECTED;
    if (awaitingSubmission && this.missingRequiredFields(updated).length === 0) {
      return this.recordSubmission(updated, 'Auto-submitted after document upload');
    }
    return updated;
  }

  /** Required profile fields that must be present before review submission. */
  private missingRequiredFields(profile: TeacherProfile): string[] {
    return [
      !profile.displayName && 'full name',
      !profile.phone && 'phone number',
      !profile.email && 'email address',
      !profile.locality && 'locality',
      !profile.city && 'city',
      !profile.category && 'primary category',
      !(profile.skills ?? []).length && 'teaching skills',
      !profile.skillDescription && 'skill description',
      !profile.whyJoin && 'reason for joining',
    ].filter(Boolean) as string[];
  }

  /** Transitions a profile to SUBMITTED, records the audit, and notifies. */
  private async recordSubmission(
    profile: TeacherProfile,
    note: string,
  ): Promise<TeacherProfile> {
    profile.verificationStatus = this.transition(
      profile.verificationStatus,
      VerificationStatus.SUBMITTED,
    );
    profile.rejectionReason = null;
    const saved = await this.profiles.save(profile);
    await this.audits.save(
      this.audits.create({
        teacherProfileId: profile.id,
        actorId: profile.userId,
        action: VerificationStatus.SUBMITTED,
        note,
      }),
    );
    await this.notify(
      profile.userId,
      'Provider profile submitted',
      'Your provider profile was submitted for review. We will notify you once an administrator has reviewed it.',
    );
    return saved;
  }

  /** Inserts an in-app customer notification. */
  private async notify(userId: string, title: string, body: string): Promise<void> {
    await this.db.query(
      `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
       VALUES ($1, 'verification', $2, $3, NULL)`,
      [userId, title, body],
    );
  }

  /** Finds APPROVED teachers within radiusMeters of a point, nearest first. */
  async findNearby(lat: number, lng: number, radiusMeters: number): Promise<TeacherProfile[]> {
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

  /**
   * Teacher submits their profile for review (PENDING/REJECTED -> SUBMITTED).
   * Uploading a document normally auto-submits (see addDocument); this remains
   * for explicit resubmission and as a fallback.
   */
  async submitForReview(userId: string): Promise<TeacherProfile> {
    const profile = await this.getByUserIdOrThrow(userId);
    const missing = this.missingRequiredFields(profile);
    if (missing.length) {
      throw new BadRequestException(
        `Complete these required profile fields before submitting: ${missing.join(', ')}`,
      );
    }
    if ((profile.documents ?? []).length === 0) {
      throw new BadRequestException(
        'At least one document is required before submitting for review',
      );
    }
    return this.recordSubmission(profile, 'Submitted for review');
  }

  /** Admin moves a submitted profile into review. */
  async startReview(profileId: string, actorId: string): Promise<TeacherProfile> {
    return this.applyTransition(profileId, VerificationStatus.UNDER_REVIEW, actorId);
  }

  /** Admin approves a profile. */
  async approve(profileId: string, actorId: string): Promise<TeacherProfile> {
    return this.applyTransition(profileId, VerificationStatus.APPROVED, actorId);
  }

  /** Admin rejects a profile with an optional reason. */
  async reject(profileId: string, actorId: string, reason?: string): Promise<TeacherProfile> {
    return this.applyTransition(profileId, VerificationStatus.REJECTED, actorId, reason ?? null);
  }

  listByStatus(status: VerificationStatus): Promise<TeacherProfile[]> {
    return this.profiles.find({
      where: { verificationStatus: status },
      order: { updatedAt: 'DESC' },
    });
  }

  async moderationHistory() {
    return (await this.audits.find({ order: { createdAt: 'DESC' }, take: 100 })).map((audit) =>
      audit.toDto(),
    );
  }

  private async applyTransition(
    profileId: string,
    to: VerificationStatus,
    actorId: string,
    rejectionReason: string | null = null,
  ): Promise<TeacherProfile> {
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new NotFoundException('Teacher profile not found');
    }
    profile.verificationStatus = this.transition(profile.verificationStatus, to);
    if (to === VerificationStatus.REJECTED) {
      profile.rejectionReason = rejectionReason;
    }
    const saved = await this.profiles.save(profile);
    await this.audits.save(
      this.audits.create({
        teacherProfileId: profileId,
        actorId,
        action: to,
        note: rejectionReason,
      }),
    );
    await this.notify(
      profile.userId,
      `Provider profile ${to.replaceAll('_', ' ')}`,
      to === VerificationStatus.APPROVED
        ? 'Your provider identity is approved. Eligible classes can now be approved for families.'
        : to === VerificationStatus.REJECTED
          ? `Your provider profile needs changes.${rejectionReason ? ` ${rejectionReason}` : ''}`
          : 'An administrator has started reviewing your provider profile.',
    );
    return saved;
  }
}
