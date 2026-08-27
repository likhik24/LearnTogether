import {
  assertValidTimings,
  generateOccurrences,
  isValidTiming,
  isValidWeekday,
} from './timing';

describe('operating-window timing model', () => {
  it('accepts a weekday evening that fits the window', () => {
    // Wednesday 18:00 for 60m -> ends 19:00, inside 07:00-22:00.
    expect(isValidTiming({ weekday: 3, startMinute: 18 * 60 }, 60)).toBe(
      true,
    );
  });

  it('accepts a Saturday morning session', () => {
    // Saturday 10:00 for 60m -> ends 11:00, inside 07:00-22:00.
    expect(isValidWeekday(6)).toBe(true);
    expect(isValidTiming({ weekday: 6, startMinute: 10 * 60 }, 60)).toBe(
      true,
    );
  });

  it('accepts a Sunday session', () => {
    expect(isValidWeekday(7)).toBe(true);
    expect(isValidTiming({ weekday: 7, startMinute: 9 * 60 }, 60)).toBe(true);
  });

  it('rejects invalid weekday numbers', () => {
    expect(isValidWeekday(0)).toBe(false);
    expect(isValidWeekday(8)).toBe(false);
    expect(isValidTiming({ weekday: 8, startMinute: 10 * 60 }, 60)).toBe(false);
  });

  it('rejects times before the operating window', () => {
    // 06:30 is before 07:00.
    expect(isValidTiming({ weekday: 2, startMinute: 6 * 60 + 30 }, 60)).toBe(
      false,
    );
  });

  it('rejects sessions that overflow past 22:00', () => {
    // 21:30 + 60m = 22:30 -> past the window.
    expect(
      isValidTiming({ weekday: 2, startMinute: 21 * 60 + 30 }, 60),
    ).toBe(false);
  });

  it('assertValidTimings throws for empty or invalid timings', () => {
    expect(() => assertValidTimings([], 60)).toThrow();
    expect(() =>
      assertValidTimings([{ weekday: 6, startMinute: 6 * 60 }], 60),
    ).toThrow();
  });
});

describe('availability occurrence generation', () => {
  const from = new Date('2024-01-01T00:00:00Z'); // Monday

  it('expands recurring Monday evenings within the horizon', () => {
    const occ = generateOccurrences(
      [{ weekday: 1, startMinute: 18 * 60 }],
      60,
      8,
      { from, days: 14 },
    );
    expect(occ.length).toBeGreaterThanOrEqual(2);
    expect(occ[0].start).toBe('2024-01-01T18:00:00.000Z');
    expect(occ[0].end).toBe('2024-01-01T19:00:00.000Z');
    expect(occ[0].seatsTotal).toBe(8);
    expect(occ[0].seatsAvailable).toBe(8);
  });

  it('subtracts booked seats via the seatsAvailable hook', () => {
    const occ = generateOccurrences(
      [{ weekday: 1, startMinute: 18 * 60 }],
      60,
      8,
      { from, days: 8, seatsAvailable: () => 3 },
    );
    expect(occ[0].seatsAvailable).toBe(3);
  });

  it('returns occurrences sorted by start time', () => {
    const occ = generateOccurrences(
      [
        { weekday: 3, startMinute: 19 * 60 },
        { weekday: 1, startMinute: 18 * 60 },
      ],
      60,
      8,
      { from, days: 7 },
    );
    const starts = occ.map((o) => o.start);
    expect([...starts].sort()).toEqual(starts);
  });
});
