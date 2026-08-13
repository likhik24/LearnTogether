import { buildSearchQuery, parseIntent } from './intent';

describe('voice intent parsing', () => {
  it('parses "evening jiu jitsu near me"', () => {
    const intent = parseIntent('evening jiu jitsu near me');
    expect(intent.activity).toBe('jiu jitsu');
    expect(intent.eveningOnly).toBe(true);
    expect(intent.nearMe).toBe(true);
    expect(intent.radiusMeters).toBe(5000);
  });

  it('extracts an explicit radius in km', () => {
    expect(parseIntent('boxing within 3 km').radiusMeters).toBe(3000);
  });

  it('converts miles to metres', () => {
    expect(parseIntent('yoga within 2 miles').radiusMeters).toBe(3219);
  });

  it('recognises multi-word activities over single words', () => {
    expect(parseIntent('brazilian jiu jitsu classes').activity).toBe(
      'brazilian jiu jitsu',
    );
  });

  it('builds a clean search query, adding an evening hint', () => {
    const q = buildSearchQuery(parseIntent('evening jiu jitsu near me'));
    expect(q).toContain('jiu jitsu');
    expect(q).toContain('evening');
    expect(q).not.toContain('near');
  });

  it('falls back to keywords when no known activity is present', () => {
    const intent = parseIntent('underwater basket weaving nearby');
    expect(intent.activity).toBeNull();
    expect(buildSearchQuery(intent)).toContain('basket');
  });
});
