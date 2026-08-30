import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, JwtAuthGuard, type AuthPrincipal } from '@learn-and-build/nest-auth';
import type { PaymentDto, PaymentIntentResponse } from '@learn-and-build/types';
import { CreatePaymentDto, VerifyPaymentDto } from './payment.dto';
import { PaymentsService } from './payments.service';
import { RazorpayGateway } from './razorpay.gateway';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly gateway: RazorpayGateway,
  ) {}

  @Get('ready') ready(): { ready: boolean; provider: string } {
    return this.payments.ready();
  }

  @Post('intents')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreatePaymentDto,
  ): Promise<PaymentIntentResponse> {
    return this.payments.createIntent(user.sub, dto.bookingId);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  async verify(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto,
  ): Promise<PaymentDto> {
    return (await this.payments.verify(user.sub, id, dto)).toDto();
  }

  @Get('booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  async byBooking(
    @CurrentUser() user: AuthPrincipal,
    @Param('bookingId') bookingId: string,
  ): Promise<PaymentDto | null> {
    return (await this.payments.byBooking(user.sub, bookingId))?.toDto() ?? null;
  }

  @Post('booking/:bookingId/refund')
  @UseGuards(JwtAuthGuard)
  async refund(
    @CurrentUser() user: AuthPrincipal,
    @Param('bookingId') bookingId: string,
  ): Promise<PaymentDto | null> {
    return (await this.payments.refund(user.sub, bookingId))?.toDto() ?? null;
  }

  @Post('webhooks/razorpay')
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature = '',
    @Headers('x-razorpay-event-id') eventId = '',
  ): Promise<{ received: true }> {
    if (!request.rawBody || !eventId)
      throw new BadRequestException('Webhook body or event id is missing');
    this.gateway.verifyWebhook(request.rawBody, signature);
    await this.payments.webhook(eventId, JSON.parse(request.rawBody.toString('utf8')) as never);
    return { received: true };
  }
}
