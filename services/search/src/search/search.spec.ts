import { EMBEDDING_DIM } from './embedding';
import { buildClassDocument, type ClassDocument } from './document';
import { hybridSearch } from './search-engine';
import { haversineMeters, withinRadius } from './geo';

const BLR = { lat: 12.9716, lng: 77.5946 };
const NEAR = { lat: 12.975, lng: 77.6 }; // ~600m away
const FAR = { lat: 13.2, lng: 77.9 }; // > 30km away

function doc(
  classId: string,
  activity: string,
  description: string,
  location = NEAR,
): ClassDocument {
  return buildClassDocument({
    classId,
    teacherId: `t-${classId}`,
    activity,
    description,
    location,
  });
}

describe('indexing pipeline (buildClassDocument)', () => {
  it('produces concepts, tokens and a normalized embedding', () => {
    const d = doc('c1', 'Jiu Jitsu', 'Beginner friendly grappling');
    expect(d.concepts).toContain('martial arts');
    expect(d.tokens).toEqual(expect.arrayContaining(['jiu', 'jitsu']));
    expect(d.embedding).toHaveLength(EMBEDDING_DIM);
    const norm = Math.sqrt(d.embedding.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
});

describe('5km radius correctness', () => {
  it('haversine + withinRadius agree with a 5km threshold', () => {
    expect(haversineMeters(BLR, NEAR)).toBeLessThan(5000);
    expect(haversineMeters(BLR, FAR)).toBeGreaterThan(5000);
    expect(withinRadius(BLR, NEAR, 5000)).toBe(true);
    expect(withinRadius(BLR, FAR, 5000)).toBe(false);
  });

  it('excludes classes outside the radius from results', () => {
    const docs = [
      doc('near', 'Jiu Jitsu', 'evening classes', NEAR),
      doc('far', 'Jiu Jitsu', 'evening classes', FAR),
    ];
    const hits = hybridSearch(docs, {
      query: 'jiu jitsu',
      origin: BLR,
      radiusMeters: 5000,
    });
    expect(hits.map((h) => h.classId)).toEqual(['near']);
    expect(hits[0].distanceMeters).toBeLessThan(5000);
  });
});

describe('semantic ranking (text path)', () => {
  it('matches "martial arts" to a Jiu Jitsu class', () => {
    const docs = [
      doc('jj', 'Jiu Jitsu', 'grappling and sparring'),
      doc('yoga', 'Yoga', 'breathing and stretching'),
    ];
    const hits = hybridSearch(docs, { query: 'martial arts' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].classId).toBe('jj');
  });

  it('orders more relevant classes first', () => {
    const docs = [
      doc('jj', 'Jiu Jitsu', 'evening grappling'),
      doc('yoga', 'Yoga', 'morning stretching'),
      doc('piano', 'Piano', 'music lessons'),
    ];
    const hits = hybridSearch(docs, { query: 'evening jiu jitsu' });
    expect(hits[0].classId).toBe('jj');
    const jjScore = hits.find((h) => h.classId === 'jj')!.score;
    const yogaHit = hits.find((h) => h.classId === 'yoga');
    if (yogaHit) expect(jjScore).toBeGreaterThan(yogaHit.score);
  });
});
