import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ClassSearchResponse,
  VoiceQueryResponse,
} from '@learn-and-build/types';
import { buildSearchQuery, parseIntent } from './intent';

export interface VoiceQueryInput {
  transcript: string;
  lat?: number;
  lng?: number;
}

/**
 * Turns a natural-language / voice transcript into a structured intent and
 * delegates to the search service. Speech-to-text (e.g. AWS Transcribe) sits in
 * front of this and produces the transcript; here we implement the text path.
 */
@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly config: ConfigService) {}

  private get searchUrl(): string {
    return this.config.get<string>('SEARCH_SERVICE_URL', 'http://localhost:3003');
  }

  async query(input: VoiceQueryInput): Promise<VoiceQueryResponse> {
    const intent = parseIntent(input.transcript);
    const q = buildSearchQuery(intent);

    const params = new URLSearchParams({ q });
    // Honour "near me" only when the caller supplied a location.
    if (intent.nearMe && input.lat !== undefined && input.lng !== undefined) {
      params.set('lat', String(input.lat));
      params.set('lng', String(input.lng));
      params.set('radius', String(intent.radiusMeters));
    }

    const results = await this.runSearch(params);
    return { transcript: input.transcript, intent, results };
  }

  private async runSearch(
    params: URLSearchParams,
  ): Promise<ClassSearchResponse> {
    const empty: ClassSearchResponse = {
      query: params.get('q') ?? '',
      total: 0,
      hits: [],
    };
    try {
      const res = await fetch(`${this.searchUrl}/search?${params.toString()}`);
      if (!res.ok) return empty;
      return (await res.json()) as ClassSearchResponse;
    } catch (err) {
      this.logger.warn(
        `Search service unreachable: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return empty;
    }
  }
}
