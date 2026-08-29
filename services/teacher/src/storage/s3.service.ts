import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { PresignedImageUploadResponse, PresignedUploadResponse } from '@learn-and-build/types';
import type { Readable } from 'node:stream';

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

  buildImageKey(userId: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `teachers/${userId}/class-images/${randomUUID()}-${safeName}`;
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

  async createClassImageUpload(
    userId: string,
    fileName: string,
    contentType: string,
  ): Promise<PresignedImageUploadResponse> {
    const storageKey = this.buildImageKey(userId, fileName);
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: contentType,
      }),
      { expiresIn: this.expiresIn },
    );
    const encoded = Buffer.from(storageKey).toString('base64url');
    return {
      uploadUrl,
      storageKey,
      publicUrl: `/api/teacher/class-images/${encoded}`,
      expiresInSeconds: this.expiresIn,
    };
  }

  async getObject(key: string): Promise<{ body?: Readable; contentType?: string }> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    return {
      body: result.Body as Readable | undefined,
      contentType: result.ContentType,
    };
  }

  isOwnedDocumentKey(userId: string, key: string): boolean {
    return key.startsWith(`teachers/${userId}/`) && !key.includes('/class-images/');
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
