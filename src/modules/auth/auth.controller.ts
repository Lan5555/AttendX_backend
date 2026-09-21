import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterLecturerDto } from './dto/register-lecturer.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register/student')
  @ApiOperation({ summary: 'Register a new student account' })
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto);
  }

  @Public()
  @Post('register/lecturer')
  @ApiOperation({ summary: 'Register a new lecturer account' })
  registerLecturer(@Body() dto: RegisterLecturerDto) {
    return this.authService.registerLecturer(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email/Student ID/Staff ID + password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }
}
