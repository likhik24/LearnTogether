import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  VerificationStatus,
  type AvailabilityDay,
  type ChildAgeGroup,
  type ChildrenExperience,
  type ClassVenuePreference,
  type GeoLocation,
  type ProviderAgeBand,
  type ProviderCategory,
  type ProviderExperience,
  type SessionFrequency,
  type TeachingFormat,
  type TeacherProfileDto,
  type TimeSlot,
  type TravelRadius,
} from '@learn-and-build/types';
import { TeacherDocument } from './teacher-document.entity';

/** GeoJSON point as stored/returned by PostGIS geography columns. */
interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

@Entity({ name: 'teacher_profiles' })
export class TeacherProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'display_name' })
  displayName!: string;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  subjects!: string[];

  // --- Provider onboarding + availability (nullable; validated at DTO layer) ---
  // Enum-valued fields are stored as varchar to avoid managing many Postgres
  // enum types; the DTO constrains them to the shared enums.

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ name: 'age_band', type: 'varchar', nullable: true })
  ageBand!: ProviderAgeBand | null;

  @Column({ type: 'varchar', nullable: true })
  locality!: string | null;

  @Column({ type: 'varchar', nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', nullable: true })
  category!: ProviderCategory | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  subcategories!: string[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  skills!: string[];

  @Column({ name: 'skill_description', type: 'text', nullable: true })
  skillDescription!: string | null;

  @Column({ name: 'years_experience', type: 'varchar', nullable: true })
  yearsExperience!: ProviderExperience | null;

  @Column({ type: 'text', nullable: true })
  portfolio!: string | null;

  @Column({ name: 'children_experience', type: 'varchar', nullable: true })
  childrenExperience!: ChildrenExperience | null;

  @Column({ name: 'children_experience_detail', type: 'text', nullable: true })
  childrenExperienceDetail!: string | null;

  @Column({ name: 'child_age_groups', type: 'text', array: true, default: () => "'{}'" })
  childAgeGroups!: ChildAgeGroup[];

  @Column({ name: 'teaching_formats', type: 'text', array: true, default: () => "'{}'" })
  teachingFormats!: TeachingFormat[];

  @Column({ name: 'venue_preferences', type: 'text', array: true, default: () => "'{}'" })
  venuePreferences!: ClassVenuePreference[];

  @Column({ name: 'travel_radius', type: 'varchar', nullable: true })
  travelRadius!: TravelRadius | null;

  @Column({ name: 'available_days', type: 'text', array: true, default: () => "'{}'" })
  availableDays!: AvailabilityDay[];

  @Column({ name: 'time_slots', type: 'text', array: true, default: () => "'{}'" })
  timeSlots!: TimeSlot[];

  @Column({ name: 'preferred_availability', type: 'text', nullable: true })
  preferredAvailability!: string | null;

  @Column({ name: 'session_frequency', type: 'varchar', nullable: true })
  sessionFrequency!: SessionFrequency | null;

  @Column({ name: 'why_join', type: 'text', nullable: true })
  whyJoin!: string | null;

  // PostGIS geography point (WGS84 / SRID 4326). Spatial index for proximity queries.
  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: GeoJsonPoint | null;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus!: VerificationStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @OneToMany(() => TeacherDocument, (doc) => doc.profile, {
    cascade: true,
    eager: true,
  })
  documents!: TeacherDocument[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  private locationToGeo(): GeoLocation | null {
    if (!this.location) return null;
    const [lng, lat] = this.location.coordinates;
    return { lat, lng };
  }

  toDto(): TeacherProfileDto {
    return {
      id: this.id,
      userId: this.userId,
      displayName: this.displayName,
      bio: this.bio ?? null,
      subjects: this.subjects ?? [],
      location: this.locationToGeo(),
      verificationStatus: this.verificationStatus,
      documents: (this.documents ?? []).map((d) => d.toDto()),
      phone: this.phone ?? null,
      email: this.email ?? null,
      ageBand: this.ageBand ?? null,
      locality: this.locality ?? null,
      city: this.city ?? null,
      category: this.category ?? null,
      subcategories: this.subcategories ?? [],
      skills: this.skills ?? [],
      skillDescription: this.skillDescription ?? null,
      yearsExperience: this.yearsExperience ?? null,
      portfolio: this.portfolio ?? null,
      childrenExperience: this.childrenExperience ?? null,
      childrenExperienceDetail: this.childrenExperienceDetail ?? null,
      childAgeGroups: this.childAgeGroups ?? [],
      teachingFormats: this.teachingFormats ?? [],
      venuePreferences: this.venuePreferences ?? [],
      travelRadius: this.travelRadius ?? null,
      availableDays: this.availableDays ?? [],
      timeSlots: this.timeSlots ?? [],
      preferredAvailability: this.preferredAvailability ?? null,
      sessionFrequency: this.sessionFrequency ?? null,
      whyJoin: this.whyJoin ?? null,
      createdAt: this.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: this.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
