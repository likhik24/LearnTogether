import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { PresignedUploadResponse } from '@learn-and-build/types';

/**
 * Issues presigned S3 PUT URLs so clients upload documents directly to S3
 * without proxying bytes through the service.
 */
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly expiresIn: number;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('DOCUMENTS_BUCKET', 'learnbuild-documents');
    this.expiresIn = Number(config.get<string>('UPLOAD_URL_TTL', '900'));
    this.client = new S3Client({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
      // For local testing against MinIO/LocalStack, set S3_ENDPOINT.
      endpoint: config.get<string>('S3_ENDPOINT') || undefined,
      forcePathStyle: Boolean(config.get<string>('S3_ENDPOINT')),
    });
  }

  buildKey(userId: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `teachers/${userId}/${randomUUID()}-${safeName}`;
  }

  async createPresignedUpload(
    userId: string,
    fileName: string,
    contentType: string,
  ): Promise<PresignedUploadResponse> {
    const storageKey = this.buildKey(userId, fileName);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.expiresIn,
    });
    return { uploadUrl, storageKey, expiresInSeconds: this.expiresIn };
  }
}
