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
  emailVerified: boolean;
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

/* ------------------------------------------------------------------ *
 * Provider (teacher) onboarding + availability
 * ------------------------------------------------------------------ */

/** Optional self-reported age band (form question 4). */
export enum ProviderAgeBand {
  A_23_29 = '23-29',
  A_30_39 = '30-39',
  A_40_50 = '40-50',
  A_50_PLUS = '50+',
  PREFER_NOT_SAY = 'prefer_not_say',
}

/** Years practising the primary skill (form question 9). */
export enum ProviderExperience {
  LT_1 = 'lt_1',
  Y_1_3 = '1-3',
  Y_3_5 = '3-5',
  Y_5_10 = '5-10',
  Y_10_PLUS = '10+',
}

/** Prior experience working with children (form question 12). */
export enum ChildrenExperience {
  REGULARLY = 'regularly',
  OCCASIONALLY = 'occasionally',
  INFORMALLY = 'informally',
  FIRST_TIME = 'first_time',
}

/** Child age groups a provider is comfortable teaching (form question 14). */
export enum ChildAgeGroup {
  G_2_5_4 = '2.5-4',
  G_4_6 = '4-6',
  G_6_8 = '6-8',
  G_8_10 = '8-10',
  G_10_12 = '10-12',
  G_12_PLUS = '12+',
}

/** Preferred teaching formats (form question 15). */
export enum TeachingFormat {
  SMALL_GROUP = 'small_group',
  ONE_ON_ONE = 'one_on_one',
  WORKSHOPS = 'workshops',
  WEEKEND_EXPERIENCES = 'weekend_experiences',
  RECURRING_WEEKLY = 'recurring_weekly',
  SHORT_PROGRAMS = 'short_programs',
  OPEN_TO_EXPLORING = 'open_to_exploring',
}

/** Where a provider is comfortable conducting a class (form question 16). */
export enum ClassVenuePreference {
  HOME_STUDIO = 'home_studio',
  GATED_COMMUNITY = 'gated_community',
  PARENT_VENUE = 'parent_venue',
  PARTNER_SPACE = 'partner_space',
  OUTDOORS = 'outdoors',
  ONLINE = 'online',
  OPEN_TO_DISCUSS = 'open_to_discuss',
}

/** How far a provider will travel to teach (form question 17). */
export enum TravelRadius {
  WITHIN_2KM = 'within_2km',
  WITHIN_5KM = 'within_5km',
  WITHIN_10KM = 'within_10km',
  OVER_10KM = 'over_10km',
  OWN_LOCATION_ONLY = 'own_location_only',
}

/** Days of the week a provider is generally available (form question 18). */
export enum AvailabilityDay {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

/** Time-of-day slots that work for a provider (form question 19). */
export enum TimeSlot {
  S_7_9 = '7-9am',
  S_9_11 = '9-11am',
  S_11_1 = '11am-1pm',
  S_1_3 = '1-3pm',
  S_3_5 = '3-5pm',
  S_5_7 = '5-7pm',
  S_7_9_PM = '7-9pm',
}

/** How often a provider would ideally run sessions (form question 21). */
export enum SessionFrequency {
  ONE_PER_WEEK = '1_per_week',
  TWO_THREE_PER_WEEK = '2-3_per_week',
  FOUR_PLUS_PER_WEEK = '4+_per_week',
  WEEKENDS_ONLY = 'weekends_only',
  OCCASIONAL_WORKSHOPS = 'occasional_workshops',
  FLEXIBLE = 'flexible',
}

/**
 * Canonical provider categories. `discoverQuery` maps each category to the
 * search `query` key used by the home / discover category tiles, so a
 * provider's declared category lines up with how customers browse.
 */
export enum ProviderCategory {
  MUSIC = 'music',
  DANCE = 'dance',
  ART_CRAFT = 'art_craft',
  STEM = 'stem',
  STORIES_CULTURE = 'stories_culture',
  SPORTS_FITNESS = 'sports_fitness',
  LIFE_SKILLS = 'life_skills',
}

/** A provider category with its display label, discover mapping and subcategories. */
export interface ProviderCategoryDef {
  category: ProviderCategory;
  label: string;
  /** The discover/home `query` key this category maps to for search. */
  discoverQuery: string;
  subcategories: string[];
}

/**
 * Single source of truth for the provider category -> subcategory taxonomy and
 * its mapping onto the customer-facing discover categories. Consumed by the
 * provider onboarding form and by discovery so search stays aligned.
 */
export const PROVIDER_CATEGORY_TAXONOMY: readonly ProviderCategoryDef[] = [
  {
    category: ProviderCategory.MUSIC,
    label: 'Music',
    discoverQuery: 'Music',
    subcategories: [
      'Piano',
      'Guitar',
      'Carnatic music',
      'Hindustani music',
      'Other classical music',
      'Musical instruments',
    ],
  },
  {
    category: ProviderCategory.DANCE,
    label: 'Dance',
    discoverQuery: 'Dance',
    subcategories: ['Classical dance'],
  },
  {
    category: ProviderCategory.ART_CRAFT,
    label: 'Art & Craft',
    discoverQuery: 'Art',
    subcategories: ['Art / painting', 'Crafts', 'Woodworking / wooden toy making'],
  },
  {
    category: ProviderCategory.STEM,
    label: 'STEM / Robotics',
    discoverQuery: 'STEM',
    subcategories: ['STEM / science', 'Lego / building'],
  },
  {
    category: ProviderCategory.STORIES_CULTURE,
    label: 'Stories & Culture',
    discoverQuery: 'Stories',
    subcategories: ['Storytelling', 'Telugu / Indian stories', 'Sanatana / mythology stories'],
  },
  {
    category: ProviderCategory.SPORTS_FITNESS,
    label: 'Sports & Fitness',
    discoverQuery: 'Sports',
    subcategories: [
      'Sports / physical activities',
      'Karra Samu / traditional martial arts',
      'Yoga',
    ],
  },
  {
    category: ProviderCategory.LIFE_SKILLS,
    label: 'Life & Wellbeing',
    discoverQuery: 'Stories',
    subcategories: [
      'Cooking / baking',
      'Mindfulness',
      'Nature-based activities',
      'Life skills',
      'Other',
    ],
  },
] as const;

/** Resolves the discover `query` key for a provider category (search mapping). */
export function discoverQueryForCategory(category: ProviderCategory): string | null {
  return PROVIDER_CATEGORY_TAXONOMY.find((c) => c.category === category)?.discoverQuery ?? null;
}

/**
 * One-hour availability slots between 09:00 and 21:00. Value is the slot start
 * hour in 24h form (e.g. `9` = 9-10am, `20` = 8-9pm).
 */
export enum DaySlot {
  H_9 = '9',
  H_10 = '10',
  H_11 = '11',
  H_12 = '12',
  H_13 = '13',
  H_14 = '14',
  H_15 = '15',
  H_16 = '16',
  H_17 = '17',
  H_18 = '18',
  H_19 = '19',
  H_20 = '20',
}

/** Availability on a specific calendar date (used for the next ~2 months). */
export interface DateAvailability {
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  /** One-hour slots the provider is available on that date. */
  slots: DaySlot[];
}

export interface TeacherProfileDto {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  subjects: string[];
  location: GeoLocation | null;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  documents: TeacherDocumentDto[];
  // --- Provider onboarding + availability (all optional) ---
  /** Section 1 — contact + basics */
  phone: string | null;
  email: string | null;
  ageBand: ProviderAgeBand | null;
  locality: string | null;
  city: string | null;
  /** Section 2 — what they teach */
  category: ProviderCategory | null;
  subcategories: string[];
  skills: string[];
  skillDescription: string | null;
  yearsExperience: ProviderExperience | null;
  /** Section 3 — portfolio + child experience */
  portfolio: string | null;
  /** Public teaching / social profile links. */
  instagramUrl: string | null;
  preplyUrl: string | null;
  urbanproUrl: string | null;
  teacheronUrl: string | null;
  childrenExperience: ChildrenExperience | null;
  childrenExperienceDetail: string | null;
  /** Section 4 — teaching preferences */
  childAgeGroups: ChildAgeGroup[];
  teachingFormats: TeachingFormat[];
  venuePreferences: ClassVenuePreference[];
  travelRadius: TravelRadius | null;
  /** Home location (human-readable; coordinates live in `location`). */
  homeAddress: string | null;
  /** Section 5 — availability */
  availableDays: AvailabilityDay[];
  timeSlots: TimeSlot[];
  /** Specific dates (next ~2 months) with one-hour slots between 9am-9pm. */
  availabilityDates: DateAvailability[];
  preferredAvailability: string | null;
  sessionFrequency: SessionFrequency | null;
  /** Final — motivation */
  whyJoin: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response with a presigned URL the client uses to upload directly to S3. */
export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

/** Upload response for a provider-owned image that can be rendered by customers. */
export interface PresignedImageUploadResponse extends PresignedUploadResponse {
  publicUrl: string;
}

/** Preferred gender of the instructor for a class. */
export enum InstructorGender {
  MALE = 'male',
  FEMALE = 'female',
  ANY = 'any',
}

/** Provider-controlled publication state. Unpublished records are retained for audit/history. */
export enum ClassOfferingStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  UNPUBLISHED = 'unpublished',
}

/** Admin-controlled moderation lifecycle for customer-visible classes. */
export enum ClassModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
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
  status: ClassOfferingStatus;
  moderationStatus: ClassModerationStatus;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationAuditDto {
  id: string;
  resourceType: 'teacher' | 'class';
  resourceId: string;
  action: string;
  actorId: string;
  note: string | null;
  createdAt: string;
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
