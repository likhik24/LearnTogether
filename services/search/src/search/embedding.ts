import { expandConcepts, tokenize } from './concepts';

export const EMBEDDING_DIM = 96;

function hashToken(token: string): number {
  // Deterministic FNV-1a hash -> bucket index.
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % EMBEDDING_DIM;
}

/**
 * A deterministic bag-of-words embedding over tokens plus their expanded
 * concept terms, L2-normalized. Concept expansion is what lets semantically
 * related text (e.g. "martial arts" vs "jiu jitsu") land close together.
 */
export function embed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  // Concept terms may be multi-word; tokenize them so they contribute buckets.
  const conceptTokens = expandConcepts(text).flatMap(tokenize);
  for (const token of [...tokens, ...conceptTokens]) {
    vec[hashToken(token)] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot; // inputs are already normalized
}
