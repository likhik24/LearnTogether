import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { GeoLocation } from '@learn-and-build/types';

export interface GeoCandidate {
  classId: string;
  distanceMeters: number;
}

/**
 * Resolves the set of classes within a radius using PostGIS ST_DWithin against
 * the shared `class_offerings` table (owned by the scheduling service). This is
 * the geo pre-filter for search. Returns null when the database is unavailable
 * so the caller can fall back to in-memory distance filtering.
 */
@Injectable()
export class GeoCandidateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GeoCandidateService.name);
  private pool?: Pool;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) return;
    this.pool = new Pool({ connectionString, max: 4 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  async candidatesWithin(
    origin: GeoLocation,
    radiusMeters: number,
  ): Promise<GeoCandidate[] | null> {
    if (!this.pool) return null;
    try {
      const res = await this.pool.query(
        `SELECT id::text AS "classId",
                ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance
         FROM class_offerings
         WHERE location IS NOT NULL
           AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         ORDER BY distance ASC`,
        [origin.lng, origin.lat, radiusMeters],
      );
      return res.rows.map((r) => ({
        classId: r.classId as string,
        distanceMeters: Number(r.distance),
      }));
    } catch (err) {
      this.logger.warn(
        `PostGIS candidate query failed, falling back: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /** Reads all classes (for a full reindex). Returns null if DB unavailable. */
  async allClasses(): Promise<ClassRow[] | null> {
    if (!this.pool) return null;
    try {
      const res = await this.pool.query(
        `SELECT id::text AS "classId", teacher_id::text AS "teacherId",
                activity, description,
                ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
         FROM class_offerings`,
      );
      return res.rows.map((r) => ({
        classId: r.classId as string,
        teacherId: r.teacherId as string,
        activity: r.activity as string,
        description: (r.description as string) ?? null,
        location:
          r.lat != null && r.lng != null
            ? { lat: Number(r.lat), lng: Number(r.lng) }
            : null,
      }));
    } catch (err) {
      this.logger.warn(
        `PostGIS allClasses query failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}

export interface ClassRow {
  classId: string;
  teacherId: string;
  activity: string;
  description: string | null;
  location: GeoLocation | null;
}
