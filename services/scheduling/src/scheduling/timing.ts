import type { ClassOccurrence, ClassTiming } from '@learn-and-build/types';

/** Operating window: any day of the week, 07:00-22:00 (minutes from midnight). */
export const OPERATING_START_MIN = 7 * 60; // 420
export const OPERATING_END_MIN = 22 * 60; // 1320
export const MINUTES_PER_DAY = 24 * 60;

/** ISO weekday: 1=Mon .. 7=Sun. */
export function isValidWeekday(weekday: number): boolean {
  return Number.isInteger(weekday) && weekday >= 1 && weekday <= 7;
}

/**
 * A timing is valid when it falls on a real weekday (Mon-Sun) and the whole
 * session fits inside the daily operating window (07:00-22:00).
 */
export function isValidTiming(
  timing: ClassTiming,
  durationMinutes: number,
): boolean {
  if (!isValidWeekday(timing.weekday)) return false;
  if (!Number.isInteger(timing.startMinute)) return false;
  if (timing.startMinute < OPERATING_START_MIN) return false;
  if (timing.startMinute + durationMinutes > OPERATING_END_MIN) return false;
  return true;
}

export function assertValidTimings(
  timings: ClassTiming[],
  durationMinutes: number,
): void {
  if (!timings.length) {
    throw new Error('At least one timing is required');
  }
  for (const t of timings) {
    if (!isValidTiming(t, durationMinutes)) {
      throw new Error(
        `Invalid timing (weekday ${t.weekday}, start ${t.startMinute}): must be a day of the week that fits ${durationMinutes}m within 07:00-22:00`,
      );
    }
  }
}

/** ISO weekday (1=Mon .. 7=Sun) for a Date, computed in UTC. */
export function isoWeekdayUtc(date: Date): number {
  const day = date.getUTCDay(); // 0=Sun .. 6=Sat
  return day === 0 ? 7 : day;
}

export interface GenerateOptions {
  from?: Date;
  days?: number;
  seatsAvailable?: (occurrenceStart: Date) => number;
}

/**
 * Expands recurring weekly timings into concrete occurrences within a horizon.
 * Times are interpreted in UTC for determinism. `seatsAvailable` lets a caller
 * subtract bookings; by default every seat is available.
 */
export function generateOccurrences(
  timings: ClassTiming[],
  durationMinutes: number,
  seats: number,
  options: GenerateOptions = {},
): ClassOccurrence[] {
  const from = options.from ?? new Date();
  const days = options.days ?? 14;
  const horizon = new Date(from.getTime() + days * MINUTES_PER_DAY * 60_000);
  const byWeekday = new Map<number, number[]>();
  for (const t of timings) {
    const list = byWeekday.get(t.weekday) ?? [];
    list.push(t.startMinute);
    byWeekday.set(t.weekday, list);
  }

  const occurrences: ClassOccurrence[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  while (cursor <= horizon) {
    const starts = byWeekday.get(isoWeekdayUtc(cursor));
    if (starts) {
      for (const startMinute of starts) {
        const start = new Date(cursor.getTime() + startMinute * 60_000);
        if (start >= from && start <= horizon) {
          const end = new Date(start.getTime() + durationMinutes * 60_000);
          occurrences.push({
            start: start.toISOString(),
            end: end.toISOString(),
            seatsTotal: seats,
            seatsAvailable: options.seatsAvailable
              ? options.seatsAvailable(start)
              : seats,
          });
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return occurrences.sort((a, b) => a.start.localeCompare(b.start));
}
