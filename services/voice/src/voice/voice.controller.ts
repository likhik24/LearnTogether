import { Body, Controller, Post } from '@nestjs/common';
import type { VoiceQueryResponse } from '@learn-and-build/types';
import { VoiceService } from './voice.service';
import { VoiceQueryDto } from './dto/voice-query.dto';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  /** Accepts a transcript (from STT or typed) and returns ranked classes. */
  @Post('query')
  query(@Body() dto: VoiceQueryDto): Promise<VoiceQueryResponse> {
    return this.voice.query(dto);
  }
}
