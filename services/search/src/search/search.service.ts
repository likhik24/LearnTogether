import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type {
  ClassSearchHit,
  ClassSearchResponse,
  GeoLocation,
} from '@learn-and-build/types';
import {
  buildClassDocument,
  type ClassDocument,
  type ClassIndexInput,
} from './document';
import { hybridSearch } from './search-engine';
import { OpenSearchService } from './opensearch.service';
import { GeoCandidateService } from './geo-candidate.service';

export interface SearchQuery {
  query: string;
  origin?: GeoLocation;
  radiusMeters?: number;
  limit?: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  // In-memory ranking cache (source of truth for ranking); OpenSearch is the
  // durable store used to warm this on boot and survive restarts.
  private readonly cache = new Map<string, ClassDocument>();

  constructor(
    private readonly opensearch: OpenSearchService,
    private readonly geo: GeoCandidateService,
  ) {}

  async onModuleInit(): Promise<void> {
    const docs = await this.opensearch.loadAll();
    for (const doc of docs) this.cache.set(doc.classId, doc);
    if (docs.length) {
      this.logger.log(`Warmed cache with ${docs.length} classes`);
      return;
    }
    // Local/demo stacks should be searchable without a separate admin action.
    // This still writes through to OpenSearch when it is available.
    const indexed = await this.reindexAll();
    if (indexed) this.logger.log(`Bootstrapped search index with ${indexed} classes`);
  }

  async index(input: ClassIndexInput): Promise<ClassDocument> {
    const doc = buildClassDocument(input);
    this.cache.set(doc.classId, doc);
    await this.opensearch.indexDocument(doc);
    return doc;
  }

  async reindexAll(): Promise<number> {
    const rows = await this.geo.allClasses();
    if (!rows) return 0;
    for (const row of rows) {
      await this.index(row);
    }
    this.logger.log(`Reindexed ${rows.length} classes`);
    return rows.length;
  }

  async search(params: SearchQuery): Promise<ClassSearchResponse> {
    let docs = [...this.cache.values()];
    const geoFiltered = Boolean(params.origin && params.radiusMeters != null);
    let distanceById: Map<string, number> | undefined;

    if (geoFiltered) {
      const candidates = await this.geo.candidatesWithin(
        params.origin!,
        params.radiusMeters!,
      );
      if (candidates) {
        // PostGIS did the geo filter; restrict + capture precise distances.
        distanceById = new Map(
          candidates.map((c) => [c.classId, c.distanceMeters]),
        );
        docs = docs.filter((d) => distanceById!.has(d.classId));
      }
    }

    const hits = hybridSearch(docs, {
      query: params.query,
      // If PostGIS already filtered, don't re-filter; otherwise let the engine
      // apply the in-memory geo filter as a fallback.
      origin: params.origin,
      radiusMeters: distanceById ? undefined : params.radiusMeters,
      limit: params.limit,
    }).map((h) => this.withPreciseDistance(h, distanceById));

    return { query: params.query, total: hits.length, hits };
  }

  private withPreciseDistance(
    hit: ClassSearchHit,
    distanceById?: Map<string, number>,
  ): ClassSearchHit {
    if (distanceById?.has(hit.classId)) {
      return { ...hit, distanceMeters: distanceById.get(hit.classId)! };
    }
    return hit;
  }
}
