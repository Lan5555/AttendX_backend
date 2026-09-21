import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterLecturerDto {
  @ApiProperty({ example: 'Samuel Johnson' })
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'STF/0042' })
  @IsNotEmpty()
  staffId!: string;

  @ApiProperty({ example: 's.johnson@uniport.edu.ng' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'strongpassword123', minLength: 6 })
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Computer Science' })
  @IsNotEmpty()
  department!: string;

  @ApiProperty({ example: 'Faculty of Computing' })
  @IsNotEmpty()
  faculty!: string;

  @IsNotEmpty()
  biometricToken!: string;
}
