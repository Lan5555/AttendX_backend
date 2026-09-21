import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsDateString, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';

class OfflineAttendanceRecordDto {
  @ApiProperty()
  @IsUUID()
  clientRecordId: string;

  @ApiProperty()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'When the student completed verification on-device, while offline' })
  @IsDateString()
  recordedAt: string;
}

export class SyncAttendanceDto {
  @ApiProperty({ type: [OfflineAttendanceRecordDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OfflineAttendanceRecordDto)
  records: OfflineAttendanceRecordDto[];
}

export { OfflineAttendanceRecordDto };
