import { ConfigService } from '@nestjs/config';
import { ReindexConsumer } from './reindex.consumer';
import { SearchService } from '../search/search.service';

describe('ReindexConsumer.handleEvent', () => {
  let search: jest.Mocked<Pick<SearchService, 'index' | 'reindexAll'>>;
  let consumer: ReindexConsumer;

  beforeEach(() => {
    search = { index: jest.fn(), reindexAll: jest.fn() };
    consumer = new ReindexConsumer(
      { get: () => undefined } as unknown as ConfigService,
      search as unknown as SearchService,
    );
  });

  it('indexes a single class on class.upserted', async () => {
    const cls = {
      classId: 'c1',
      teacherId: 't1',
      activity: 'Jiu Jitsu',
    };
    await consumer.handleEvent({ type: 'class.upserted', class: cls });
    expect(search.index).toHaveBeenCalledWith(cls);
    expect(search.reindexAll).not.toHaveBeenCalled();
  });

  it('triggers a full reindex on reindex.all', async () => {
    await consumer.handleEvent({ type: 'reindex.all' });
    expect(search.reindexAll).toHaveBeenCalledTimes(1);
  });
});
