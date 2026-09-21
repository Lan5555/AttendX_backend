import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class EnrollDto {
  @ApiProperty({ description: 'Student ID (the account studentId, not the user UUID)' })
  @IsNotEmpty()
  studentId: string;
}
