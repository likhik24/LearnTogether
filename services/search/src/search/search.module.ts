import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { OpenSearchService } from './opensearch.service';
import { GeoCandidateService } from './geo-candidate.service';
import { ReindexConsumer } from '../reindex/reindex.consumer';

@Module({
  controllers: [SearchController],
  providers: [
    SearchService,
    OpenSearchService,
    GeoCandidateService,
    ReindexConsumer,
  ],
  exports: [SearchService],
})
export class SearchModule {}
