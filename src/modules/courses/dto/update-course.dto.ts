import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateCourseDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNotEmpty()
  scheduleDay?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNotEmpty()
  scheduleStartTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNotEmpty()
  scheduleEndTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNotEmpty()
  venue?: string;

  @ApiProperty({ required: false, example: 75 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  attendanceThreshold?: number;
}
