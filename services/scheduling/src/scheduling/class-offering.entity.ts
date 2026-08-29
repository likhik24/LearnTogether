import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ClassModerationStatus,
  ClassOfferingStatus,
  InstructorGender,
  type ClassOfferingDto,
  type ClassTiming,
  type GeoLocation,
} from '@learn-and-build/types';

interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

@Entity({ name: 'class_offerings' })
export class ClassOffering {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'teacher_id' })
  teacherId!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  slug!: string | null;

  @Column()
  activity!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ default: 'General' })
  category!: string;

  @Column({ name: 'age_min', type: 'int', default: 3 })
  ageMin!: number;

  @Column({ name: 'age_max', type: 'int', default: 6 })
  ageMax!: number;

  @Column({ name: 'price_minor', type: 'int', default: 0 })
  priceMinor!: number;

  @Column({ length: 3, default: 'INR' })
  currency!: string;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ default: 'mint' })
  tone!: string;

  @Column({ type: 'real', default: 0 })
  rating!: number;

  @Column({ name: 'review_count', type: 'int', default: 0 })
  reviewCount!: number;

  @Column({ name: 'venue_name', type: 'varchar', nullable: true })
  venueName!: string | null;

  @Column({
    name: 'instructor_gender',
    type: 'enum',
    enum: InstructorGender,
    default: InstructorGender.ANY,
  })
  instructorGender!: InstructorGender;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes!: number;

  @Column({ type: 'int' })
  seats!: number;

  // Recurring weekly timings stored as JSONB.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  timings!: ClassTiming[];

  @Column({ type: 'varchar', default: ClassOfferingStatus.ACTIVE })
  status!: ClassOfferingStatus;

  @Column({ name: 'moderation_status', type: 'varchar', default: ClassModerationStatus.PENDING })
  moderationStatus!: ClassModerationStatus;

  @Column({ name: 'moderation_reason', type: 'text', nullable: true })
  moderationReason!: string | null;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: GeoJsonPoint | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  private geo(): GeoLocation | null {
    if (!this.location) return null;
    const [lng, lat] = this.location.coordinates;
    return { lat, lng };
  }

  toDto(): ClassOfferingDto {
    return {
      id: this.id,
      teacherId: this.teacherId,
      slug: this.slug,
      activity: this.activity,
      description: this.description ?? null,
      category: this.category,
      ageMin: this.ageMin,
      ageMax: this.ageMax,
      priceMinor: this.priceMinor,
      currency: this.currency,
      imageUrl: this.imageUrl,
      tone: this.tone,
      rating: this.rating,
      reviewCount: this.reviewCount,
      venueName: this.venueName,
      instructorGender: this.instructorGender,
      durationMinutes: this.durationMinutes,
      seats: this.seats,
      location: this.geo(),
      timings: this.timings ?? [],
      status: this.status,
      moderationStatus: this.moderationStatus,
      moderationReason: this.moderationReason ?? null,
      createdAt: this.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: this.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
