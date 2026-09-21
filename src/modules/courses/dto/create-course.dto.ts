import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ example: 'CSC 416' })
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Software Engineering' })
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false, example: 'Principles of large-scale software design.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(6)
  creditUnits: number;

  @ApiProperty({ example: 'Computer Science' })
  @IsNotEmpty()
  department: string;

  @ApiProperty({ example: 'Monday' })
  @IsNotEmpty()
  scheduleDay: string;

  @ApiProperty({ example: '10:00 AM' })
  @IsNotEmpty()
  scheduleStartTime: string;

  @ApiProperty({ example: '12:00 PM' })
  @IsNotEmpty()
  scheduleEndTime: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  scheduleRecurringWeekly?: boolean;

  @ApiProperty({ example: 'Lab 3' })
  @IsNotEmpty()
  venue: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  maxStudents: number;

  @ApiProperty({ example: 75, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  attendanceThreshold?: number;
}
