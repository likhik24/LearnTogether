/**
 * Shared TypeScript types and contracts for the Learn&Build platform.
 * These are consumed by services, the API client, and apps.
 */

/** Canonical list of backend services. */
export const SERVICE_NAMES = [
  'auth',
  'teacher',
  'search',
  'scheduling',
  'voice',
  'meetings',
  'payments',
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

/** Platform roles. Drives authorization across all services. */
export enum Role {
  USER = 'user',
  TEACHER = 'teacher',
  ADMIN = 'admin',
}

/** Shape of the authenticated principal encoded in the JWT and attached to requests. */
export interface AuthPrincipal {
  /** User id (uuid). */
  sub: string;
  email: string;
  role: Role;
}

/** Public-safe representation of a user. Never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

/** Response returned by login / register. */
export interface AuthTokenResponse {
  accessToken: string;
  user: PublicUser;
}

/** Teacher verification lifecycle states. */
export enum VerificationStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** Categories of documents a teacher uploads for verification. */
export enum DocumentType {
  ID = 'id',
  CERTIFICATE = 'certificate',
  RESUME = 'resume',
  OTHER = 'other',
}

/** A simple latitude/longitude pair (WGS84). */
export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface TeacherDocumentDto {
  id: string;
  type: DocumentType;
  fileName: string;
  storageKey: string;
  uploadedAt: string;
}

export interface TeacherProfileDto {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  subjects: string[];
  location: GeoLocation | null;
  verificationStatus: VerificationStatus;
  documents: TeacherDocumentDto[];
  createdAt: string;
  updatedAt: string;
}

/** Response with a presigned URL the client uses to upload directly to S3. */
export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}


/** Standard health-check response returned by every service's `GET /health`. */
export interface HealthResponse {
  status: 'ok';
  service: ServiceName | string;
  /** ISO-8601 timestamp of when the response was generated. */
  timestamp: string;
  /** Process uptime in seconds. */
  uptime: number;
}
