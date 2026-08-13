import type { GeoLocation } from '@learn-and-build/types';
import { expandConcepts, normalize, tokenize } from './concepts';
import { embed } from './embedding';

export interface ClassIndexInput {
  classId: string;
  teacherId: string;
  activity: string;
  description?: string | null;
  location?: GeoLocation | null;
}

/** The document shape stored in OpenSearch and used by the in-memory engine. */
export interface ClassDocument {
  classId: string;
  teacherId: string;
  activity: string;
  description: string | null;
  text: string;
  concepts: string[];
  tokens: string[];
  embedding: number[];
  location: GeoLocation | null;
}

/**
 * The indexing pipeline: turns a class into a searchable document with keyword
 * tokens, expanded concept tags, and an embedding vector.
 */
export function buildClassDocument(input: ClassIndexInput): ClassDocument {
  const description = input.description ?? null;
  const text = normalize(`${input.activity} ${description ?? ''}`);
  const concepts = expandConcepts(text);
  const enriched = `${text} ${concepts.join(' ')}`;
  return {
    classId: input.classId,
    teacherId: input.teacherId,
    activity: input.activity,
    description,
    text,
    concepts,
    tokens: Array.from(new Set([...tokenize(text), ...concepts.flatMap(tokenize)])),
    embedding: embed(enriched),
    location: input.location ?? null,
  };
}
