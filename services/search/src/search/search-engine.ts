import type { ClassSearchHit, GeoLocation } from '@learn-and-build/types';
import { expandConcepts, normalize, tokenize } from './concepts';
import { cosineSimilarity, embed } from './embedding';
import { haversineMeters } from './geo';
import type { ClassDocument } from './document';

export interface SearchParams {
  query: string;
  origin?: GeoLocation | null;
  radiusMeters?: number;
  keywordWeight?: number;
  vectorWeight?: number;
  limit?: number;
}

function keywordScore(queryTokens: Set<string>, docTokens: string[]): number {
  if (queryTokens.size === 0) return 0;
  const docSet = new Set(docTokens);
  let hits = 0;
  for (const t of queryTokens) if (docSet.has(t)) hits++;
  return hits / queryTokens.size;
}

/**
 * Hybrid semantic + keyword ranking with an optional geo filter. This is the
 * reference ranker used in tests and as a fallback when OpenSearch is absent;
 * the live path delegates the vector/keyword query to OpenSearch and the geo
 * pre-filter to PostGIS ST_DWithin, but the scoring semantics match.
 */
export function hybridSearch(
  docs: ClassDocument[],
  params: SearchParams,
): ClassSearchHit[] {
  const wk = params.keywordWeight ?? 0.4;
  const wv = params.vectorWeight ?? 0.6;
  const limit = params.limit ?? 20;

  const enrichedQuery = `${normalize(params.query)} ${expandConcepts(
    params.query,
  ).join(' ')}`;
  const queryVec = embed(enrichedQuery);
  const queryTokens = new Set(tokenize(enrichedQuery));

  const hits: ClassSearchHit[] = [];
  for (const doc of docs) {
    let distanceMeters: number | null = null;
    if (params.origin && doc.location) {
      distanceMeters = haversineMeters(params.origin, doc.location);
      if (params.radiusMeters != null && distanceMeters > params.radiusMeters) {
        continue; // outside the radius -> excluded
      }
    } else if (params.origin && params.radiusMeters != null && !doc.location) {
      continue; // geo-filtered search skips docs without a location
    }

    const kw = keywordScore(queryTokens, doc.tokens);
    const vec = cosineSimilarity(queryVec, doc.embedding);
    const score = wk * kw + wv * vec;
    if (score <= 0) continue;

    hits.push({
      classId: doc.classId,
      teacherId: doc.teacherId,
      activity: doc.activity,
      description: doc.description,
      location: doc.location,
      distanceMeters,
      score,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
