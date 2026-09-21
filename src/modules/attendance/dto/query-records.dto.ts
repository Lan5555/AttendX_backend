import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryRecordsDto {
  @ApiProperty({ required: false, description: 'ISO date (yyyy-mm-dd) to filter by' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ required: false, description: 'Student ID or name (partial match)' })
  @IsOptional()
  @IsString()
  student?: string;

  @ApiProperty({ required: false, enum: ['present', 'absent'] })
  @IsOptional()
  @IsIn(['present', 'absent'])
  status?: 'present' | 'absent';
}
