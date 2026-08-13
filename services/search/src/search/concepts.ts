/**
 * Concept groups power the "text path" of semantic search: terms in the same
 * group are treated as related, so a query for "martial arts" matches a class
 * tagged "Jiu Jitsu". Expansion is applied symmetrically at index time and
 * query time, giving related items overlapping tokens and nearby embeddings.
 * (A production system would swap this for learned embeddings.)
 */
export const CONCEPT_GROUPS: string[][] = [
  [
    'martial arts',
    'combat sports',
    'self defense',
    'jiu jitsu',
    'bjj',
    'brazilian jiu jitsu',
    'judo',
    'karate',
    'boxing',
    'muay thai',
    'kickboxing',
    'taekwondo',
    'mma',
    'wrestling',
    'grappling',
  ],
  ['yoga', 'pilates', 'meditation', 'mindfulness', 'stretching'],
  ['dance', 'zumba', 'ballet', 'salsa', 'hip hop'],
  ['music', 'guitar', 'piano', 'violin', 'singing', 'vocals', 'drums'],
  ['coding', 'programming', 'software', 'python', 'javascript', 'web development'],
  ['language', 'english', 'spanish', 'french', 'german', 'mandarin'],
  ['fitness', 'gym', 'strength training', 'crossfit', 'hiit', 'workout'],
  ['swimming', 'water sports', 'diving'],
  ['painting', 'drawing', 'sketching', 'art', 'sculpture'],
];

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Returns the set of related concept terms for a piece of text: every term of
 * any group whose terms appear in the text. Includes the matched terms too.
 */
export function expandConcepts(text: string): string[] {
  const norm = normalize(text);
  const out = new Set<string>();
  for (const group of CONCEPT_GROUPS) {
    if (group.some((term) => norm.includes(term))) {
      for (const term of group) out.add(term);
    }
  }
  return [...out];
}

/** Lowercased alphanumeric word tokens. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}
