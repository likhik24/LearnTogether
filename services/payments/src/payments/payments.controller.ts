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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  Role,
  Roles,
  RolesGuard,
  type AuthPrincipal,
} from '@learn-and-build/nest-auth';
import type {
  PaymentDto,
  PaymentIntentResponse,
  ProviderEarningsDto,
  ProviderPayoutDto,
  ProviderPayoutProfileDto,
} from '@learn-and-build/types';
import {
  CreatePaymentDto,
  RequestPayoutDto,
  ReviewPayoutProfileDto,
  UpsertPayoutProfileDto,
  UpdatePayoutDto,
  VerifyPaymentDto,
} from './payment.dto';
import { PaymentsService } from './payments.service';
import { RazorpayGateway } from './razorpay.gateway';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly gateway: RazorpayGateway,
    private readonly config: ConfigService,
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
    @Headers('x-internal-service-token') internalToken = '',
  ): Promise<PaymentDto | null> {
    const expected = this.config.get<string>(
      'INTERNAL_SERVICE_SECRET',
      'dev-insecure-internal-secret',
    );
    if (!internalToken || internalToken !== expected) {
      throw new UnauthorizedException('Internal service authorization is required');
    }
    return (await this.payments.refund(user.sub, bookingId))?.toDto() ?? null;
  }

  @Post('internal/bookings/:bookingId/refund')
  async internalRefund(
    @Param('bookingId') bookingId: string,
    @Headers('x-internal-service-token') internalToken = '',
  ): Promise<PaymentDto | null> {
    this.assertInternal(internalToken);
    return (await this.payments.refundByBooking(bookingId))?.toDto() ?? null;
  }

  @Get('provider/earnings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  earnings(@CurrentUser() user: AuthPrincipal): Promise<ProviderEarningsDto> {
    return this.payments.providerEarnings(user.sub);
  }

  @Get('provider/payouts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  async providerPayouts(@CurrentUser() user: AuthPrincipal): Promise<ProviderPayoutDto[]> {
    return (await this.payments.listProviderPayouts(user.sub)).map((item) => item.toDto());
  }

  @Post('provider/payouts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  async requestPayout(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: RequestPayoutDto,
  ): Promise<ProviderPayoutDto> {
    return (await this.payments.requestProviderPayout(user.sub, dto.amountMinor)).toDto();
  }

  @Get('provider/payout-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  async payoutProfile(
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ProviderPayoutProfileDto | null> {
    return (await this.payments.getPayoutProfile(user.sub))?.toDto() ?? null;
  }

  @Post('provider/payout-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  async savePayoutProfile(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: UpsertPayoutProfileDto,
  ): Promise<ProviderPayoutProfileDto> {
    return (
      await this.payments.upsertPayoutProfile(user.sub, {
        ...dto,
        bankName: dto.bankName ?? null,
        ifsc: dto.ifsc ?? null,
        accountLast4: dto.accountLast4 ?? null,
        upiIdMasked: dto.upiIdMasked ?? null,
      })
    ).toDto();
  }

  @Get('admin/payout-profiles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async payoutProfiles(): Promise<ProviderPayoutProfileDto[]> {
    return (await this.payments.listPayoutProfiles()).map((item) => item.toDto());
  }

  @Post('admin/payout-profiles/:teacherId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async reviewPayoutProfile(
    @Param('teacherId') teacherId: string,
    @Body() dto: ReviewPayoutProfileDto,
  ): Promise<ProviderPayoutProfileDto> {
    return (
      await this.payments.reviewPayoutProfile(teacherId, dto.status, dto.externalFundAccountId)
    ).toDto();
  }

  @Get('admin/payouts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async payoutQueue(): Promise<ProviderPayoutDto[]> {
    return (await this.payments.listPayoutQueue()).map((item) => item.toDto());
  }

  @Post('admin/payouts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updatePayout(
    @Param('id') id: string,
    @Body() dto: UpdatePayoutDto,
  ): Promise<ProviderPayoutDto> {
    return (await this.payments.updatePayout(id, dto.status, dto.reference, dto.note)).toDto();
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

  private assertInternal(token: string): void {
    const expected = this.config.get<string>(
      'INTERNAL_SERVICE_SECRET',
      'dev-insecure-internal-secret',
    );
    if (!token || token !== expected) {
      throw new UnauthorizedException('Internal service authorization is required');
    }
  }
}
