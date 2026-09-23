import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class MarkAttendanceDto {
  @ApiProperty({ description: 'The attendance session being marked' })
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ description: 'The token currently shown in the lecturer\'s QR code' })
  @IsNotEmpty()
  qrToken!: string;

  @ApiProperty({
    required: false,
    description: 'Measured BLE RSSI to the lecturer beacon, in dBm (mocked client-side for now)',
    example: -58,
  })
  @IsOptional()
  @IsInt()
  bleRssi?: number;

  @ApiProperty({
    required: false,
    description: 'Whether the on-device liveness/face check passed (mocked client-side for now)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  livenessConfirmed?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Client-generated UUID for offline-first idempotency — safe to resend the same record via /sync/attendance later without duplicating it',
  })
  @IsOptional()
  @IsUUID()
  clientRecordId?: string;
}
