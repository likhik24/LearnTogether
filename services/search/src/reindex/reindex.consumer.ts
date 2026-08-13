import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import type { ClassIndexInput } from '../search/document';
import { SearchService } from '../search/search.service';

/**
 * Class-change events flow: scheduling/teacher services publish domain events
 * to EventBridge, a rule routes them to an SQS queue, and this consumer indexes
 * them asynchronously. Enabled only when SQS_QUEUE_URL is set, so it is inert
 * in local/dev by default. The event contract is exercised by handleEvent().
 */
export type ReindexEvent =
  | { type: 'class.upserted'; class: ClassIndexInput }
  | { type: 'reindex.all' };

@Injectable()
export class ReindexConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReindexConsumer.name);
  private client?: SQSClient;
  private queueUrl?: string;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly search: SearchService,
  ) {}

  onApplicationBootstrap(): void {
    this.queueUrl = this.config.get<string>('SQS_QUEUE_URL');
    if (!this.queueUrl) {
      this.logger.log('SQS_QUEUE_URL not set; async reindex consumer disabled');
      return;
    }
    this.client = new SQSClient({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.running = true;
    void this.poll();
  }

  onModuleDestroy(): void {
    this.running = false;
  }

  /** Applies a single reindex event. Pure enough to unit test in isolation. */
  async handleEvent(event: ReindexEvent): Promise<void> {
    if (event.type === 'class.upserted') {
      await this.search.index(event.class);
    } else if (event.type === 'reindex.all') {
      await this.search.reindexAll();
    }
  }

  private async poll(): Promise<void> {
    while (this.running && this.client && this.queueUrl) {
      try {
        const res = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          }),
        );
        for (const msg of res.Messages ?? []) {
          try {
            await this.handleEvent(JSON.parse(msg.Body ?? '{}') as ReindexEvent);
            await this.client.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: msg.ReceiptHandle,
              }),
            );
          } catch (err) {
            this.logger.warn(
              `Failed to process message: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `SQS receive failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}
