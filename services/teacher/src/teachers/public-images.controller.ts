import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { S3Service } from '../storage/s3.service';

@Controller('class-images')
export class PublicImagesController {
  constructor(private readonly s3: S3Service) {}

  @Get(':encodedKey')
  async image(@Param('encodedKey') encodedKey: string, @Res() response: Response): Promise<void> {
    const key = Buffer.from(encodedKey, 'base64url').toString('utf8');
    if (!/^teachers\/[0-9a-f-]+\/class-images\//i.test(key)) {
      throw new NotFoundException('Image not found');
    }
    const object = await this.s3.getObject(key);
    if (!object.body) throw new NotFoundException('Image not found');
    response.setHeader('content-type', object.contentType ?? 'application/octet-stream');
    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    object.body.pipe(response);
  }
}
