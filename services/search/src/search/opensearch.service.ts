import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { EMBEDDING_DIM } from './embedding';
import type { ClassDocument } from './document';

export const CLASS_INDEX = 'classes';

/**
 * Durable document store backed by OpenSearch. Documents carry both keyword
 * fields and the embedding vector. All calls are defensive: if OpenSearch is
 * unreachable the service still boots and the caller can fall back to its
 * in-memory cache.
 */
@Injectable()
export class OpenSearchService implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchService.name);
  private client?: Client;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const node = this.config.get<string>('OPENSEARCH_URL');
    if (!node) {
      this.logger.warn('OPENSEARCH_URL not set; running without OpenSearch');
      return;
    }
    try {
      this.client = new Client({ node });
      await this.ensureIndex();
      this.logger.log(`Connected to OpenSearch at ${node}`);
    } catch (err) {
      this.client = undefined;
      this.logger.warn(
        `OpenSearch unavailable, continuing without it: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  get available(): boolean {
    return this.client !== undefined;
  }

  private async ensureIndex(): Promise<void> {
    if (!this.client) return;
    const exists = await this.client.indices.exists({ index: CLASS_INDEX });
    if (exists.body) return;
    await this.client.indices.create({
      index: CLASS_INDEX,
      body: {
        mappings: {
          properties: {
            classId: { type: 'keyword' },
            teacherId: { type: 'keyword' },
            activity: { type: 'text' },
            description: { type: 'text' },
            text: { type: 'text' },
            concepts: { type: 'keyword' },
            tokens: { type: 'keyword' },
            embedding: { type: 'float' },
            location: { type: 'geo_point' },
            embeddingDim: { type: 'integer' },
          },
        },
      },
    });
  }

  async indexDocument(doc: ClassDocument): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.index({
        index: CLASS_INDEX,
        id: doc.classId,
        body: {
          ...doc,
          embeddingDim: EMBEDDING_DIM,
          location: doc.location
            ? { lat: doc.location.lat, lon: doc.location.lng }
            : null,
        },
        refresh: true,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to index ${doc.classId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Loads all stored documents (used to warm the in-memory ranking cache). */
  async loadAll(): Promise<ClassDocument[]> {
    if (!this.client) return [];
    try {
      const res = await this.client.search({
        index: CLASS_INDEX,
        body: { size: 1000, query: { match_all: {} } },
      });
      const hits = res.body.hits.hits as Array<{ _source: RawDoc }>;
      return hits.map((h) => fromSource(h._source));
    } catch {
      return [];
    }
  }
}

interface RawDoc {
  classId: string;
  teacherId: string;
  activity: string;
  description: string | null;
  text: string;
  concepts: string[];
  tokens: string[];
  embedding: number[];
  location: { lat: number; lon: number } | null;
}

function fromSource(src: RawDoc): ClassDocument {
  return {
    classId: src.classId,
    teacherId: src.teacherId,
    activity: src.activity,
    description: src.description ?? null,
    text: src.text,
    concepts: src.concepts ?? [],
    tokens: src.tokens ?? [],
    embedding: src.embedding ?? [],
    location: src.location
      ? { lat: src.location.lat, lng: src.location.lon }
      : null,
  };
}
