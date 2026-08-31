import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() bookingReminders?: boolean;
  @IsOptional() @IsBoolean() productUpdates?: boolean;
}
