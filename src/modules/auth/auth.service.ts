import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterLecturerDto } from './dto/register-lecturer.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async registerStudent(dto: RegisterStudentDto) {
    const user = await this.usersService.createStudent(dto);
    return this.buildAuthResponse(user);
  }

  async registerLecturer(dto: RegisterLecturerDto) {
    const user = await this.usersService.createLecturer(dto);
    return this.buildAuthResponse(user);
  }

  async login(identifier: string, password: string) {
    const user = await this.usersService.findByIdentifier(identifier);
    if (!user) throw new UnauthorizedException('Incorrect email/ID or password.');

    const isValid = await this.usersService.validatePassword(user, password);
    if (!isValid) throw new UnauthorizedException('Incorrect email/ID or password.');

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      user: await this.usersService.toProfile(user),
    };
  }

  async pingServer(){
    return {
      success: true,
      message: 'Server Ready'
    }
  }
}
