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

/** Identity provider a user authenticated with. */
export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  AWS = 'aws',
}

/** Public-safe representation of a user. Never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  provider: AuthProvider;
  createdAt: string;
}

/** Response returned by login / register. */
export interface AuthTokenResponse {
  accessToken: string;
  user: PublicUser;
}

/** A configured OIDC provider the client can offer as a sign-in option. */
export interface OidcProviderInfo {
  /** Stable id used in the login URL, e.g. "google" or "aws". */
  id: string;
  /** Human-friendly label for the sign-in button. */
  label: string;
  /** Absolute URL that begins the login redirect flow. */
  loginUrl: string;
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

/** Preferred gender of the instructor for a class. */
export enum InstructorGender {
  MALE = 'male',
  FEMALE = 'female',
  ANY = 'any',
}

/**
 * A recurring weekly timing. `weekday` is ISO (1=Mon .. 7=Sun); the platform
 * focuses on weekday evenings. `startMinute` is minutes from local midnight.
 */
export interface ClassTiming {
  weekday: number;
  startMinute: number;
}

export interface ClassOfferingDto {
  id: string;
  teacherId: string;
  slug: string | null;
  activity: string;
  description: string | null;
  category: string;
  ageMin: number;
  ageMax: number;
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  tone: string;
  rating: number;
  reviewCount: number;
  venueName: string | null;
  instructorGender: InstructorGender;
  durationMinutes: number;
  seats: number;
  location: GeoLocation | null;
  timings: ClassTiming[];
  createdAt: string;
  updatedAt: string;
}

/** A concrete future occurrence of a recurring class, with seat availability. */
export interface ClassOccurrence {
  start: string;
  end: string;
  seatsTotal: number;
  seatsAvailable: number;
}

/** Customer-facing class data enriched with its next available occurrence. */
export interface DiscoverClassDto extends ClassOfferingDto {
  distanceMeters: number | null;
  nextOccurrence: ClassOccurrence | null;
}

export enum ReservationStatus {
  RESERVED = 'reserved',
  CANCELLED = 'cancelled',
}

/** An atomic seat hold owned by a signed-in customer. */
export interface ClassReservationDto {
  id: string;
  classId: string;
  userId: string;
  occurrenceStart: string;
  seats: number;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

/** A ranked search hit for a class. */
export interface ClassSearchHit {
  classId: string;
  teacherId: string;
  activity: string;
  description: string | null;
  location: GeoLocation | null;
  distanceMeters: number | null;
  score: number;
}

export interface ClassSearchResponse {
  query: string;
  total: number;
  hits: ClassSearchHit[];
}

/** Structured intent parsed from a natural-language / voice query. */
export interface VoiceIntent {
  activity: string | null;
  eveningOnly: boolean;
  nearMe: boolean;
  radiusMeters: number;
  keywords: string[];
}

export interface VoiceQueryResponse {
  transcript: string;
  intent: VoiceIntent;
  results: ClassSearchResponse;
}

/** Lifecycle of a class meeting session. */
export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

export interface MeetingDto {
  id: string;
  classId: string;
  hostId: string;
  provider: string;
  roomName: string;
  status: MeetingStatus;
  scheduledStart: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Short-lived credentials a participant uses to join a meeting. */
export interface MeetingJoinInfo {
  meetingId: string;
  token: string;
  joinUrl: string;
  expiresAt: string;
}

/** Lifecycle of a payment for a class booking. */
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export interface PaymentDto {
  id: string;
  userId: string;
  classId: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response when creating a payment: includes client secret for the provider. */
export interface PaymentIntentResponse {
  payment: PaymentDto;
  clientSecret: string;
}

/** A child belonging to the signed-in parent account. */
export interface ChildProfileDto {
  id: string;
  userId: string;
  name: string;
  birthDate: string | null;
  interests: string[];
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

/** A class saved by a parent for later. `classRef` may be a UUID or public slug. */
export interface SavedClassDto {
  id: string;
  userId: string;
  classRef: string;
  title: string;
  createdAt: string;
}

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

/** Customer booking snapshot owned by the authenticated user. */
export interface BookingDto {
  id: string;
  userId: string;
  classRef: string;
  classSlug: string | null;
  reservationId: string | null;
  title: string;
  scheduledStart: string;
  amountMinor: number;
  currency: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

/** In-app notification for the authenticated customer. */
export interface CustomerNotificationDto {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
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
