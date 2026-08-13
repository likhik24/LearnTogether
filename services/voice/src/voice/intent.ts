import type { VoiceIntent } from '@learn-and-build/types';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'me', 'my', 'i', 'want', 'find', 'show', 'looking',
  'for', 'to', 'near', 'nearby', 'around', 'close', 'by', 'in', 'at', 'some',
  'please', 'class', 'classes', 'lesson', 'lessons', 'within', 'and',
]);

// Recognised activity phrases (longest first so multi-word wins).
const ACTIVITIES = [
  'brazilian jiu jitsu', 'jiu jitsu', 'muay thai', 'martial arts', 'hip hop',
  'strength training', 'personal training', 'boxing', 'kickboxing', 'karate',
  'judo', 'yoga', 'pilates', 'zumba', 'salsa', 'ballet', 'guitar', 'piano',
  'violin', 'singing', 'coding', 'programming', 'painting', 'swimming',
  'crossfit', 'dance', 'music',
];

/** Parses a transcript into a structured search intent (the "text path"). */
export function parseIntent(transcript: string): VoiceIntent {
  const norm = transcript.toLowerCase().replace(/\s+/g, ' ').trim();

  const eveningOnly = /\b(evening|evenings|night|nights|tonight)\b/.test(norm);
  const nearMe = /\bnear me\b|\bnearby\b|\baround me\b|\bclose by\b|\bnear\b/.test(
    norm,
  );

  let radiusMeters = 5000;
  const radiusMatch = norm.match(
    /(\d+(?:\.\d+)?)\s*(km|kilometers?|kilometres?|m|meters?|metres?|miles?|mi)\b/,
  );
  if (radiusMatch) {
    const value = parseFloat(radiusMatch[1]);
    const unit = radiusMatch[2];
    if (unit.startsWith('km') || unit.startsWith('kilom')) {
      radiusMeters = Math.round(value * 1000);
    } else if (unit.startsWith('mi')) {
      radiusMeters = Math.round(value * 1609.34);
    } else {
      radiusMeters = Math.round(value);
    }
  }

  const activity = ACTIVITIES.find((a) => norm.includes(a)) ?? null;

  const keywords = norm
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

  return { activity, eveningOnly, nearMe, radiusMeters, keywords };
}

/** Builds the query string handed to the search service. */
export function buildSearchQuery(intent: VoiceIntent): string {
  const parts = intent.activity
    ? [intent.activity]
    : intent.keywords.filter((k) => !/^\d+$/.test(k));
  if (intent.eveningOnly && !parts.includes('evening')) parts.push('evening');
  return parts.join(' ').trim();
}
