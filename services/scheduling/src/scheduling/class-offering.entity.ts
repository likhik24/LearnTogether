import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
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

  @Column()
  activity!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

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
      activity: this.activity,
      description: this.description ?? null,
      instructorGender: this.instructorGender,
      durationMinutes: this.durationMinutes,
      seats: this.seats,
      location: this.geo(),
      timings: this.timings ?? [],
      createdAt: this.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: this.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
