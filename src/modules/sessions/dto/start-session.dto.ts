import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class StartSessionDto {
  @ApiProperty()
  @IsNotEmpty()
  courseId: string;
}
