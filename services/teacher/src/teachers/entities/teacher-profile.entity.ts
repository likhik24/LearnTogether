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
  type GeoLocation,
  type TeacherProfileDto,
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
      createdAt: this.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: this.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
