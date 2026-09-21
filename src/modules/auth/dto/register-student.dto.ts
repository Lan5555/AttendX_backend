import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterStudentDto {
  @ApiProperty({ example: 'Nicholas Johnson' })
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'CSC/21/1234' })
  @IsNotEmpty()
  studentId!: string;

  @ApiProperty({ example: 'nicholas.johnson@uniport.edu.ng' })
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
