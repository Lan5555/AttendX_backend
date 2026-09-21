import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'nicholas.johnson@uniport.edu.ng',
    description: 'Email, Student ID, or Staff ID',
  })
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'strongpassword123' })
  @IsNotEmpty()
  password: string;
}
