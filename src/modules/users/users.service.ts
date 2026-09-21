import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { UserRole } from '../../common/enums/user-role.enum';

export interface CreateStudentInput {
  fullName: string;
  studentId: string;
  email: string;
  password: string;
  department: string;
  faculty: string;
  biometricToken: string
}

export interface CreateLecturerInput {
  fullName: string;
  staffId: string;
  email: string;
  password: string;
  department: string;
  faculty: string;
  biometricToken: string
}

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Enrollment) private readonly enrollmentsRepo: Repository<Enrollment>,
  ) {}

  async createStudent(input: CreateStudentInput): Promise<User> {
    await this.assertEmailAvailable(input.email);
    await this.assertStudentIdAvailable(input.studentId);

    const user = this.usersRepo.create({
      fullName: input.fullName,
      email: input.email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
      role: UserRole.STUDENT,
      department: input.department,
      faculty: input.faculty,
      studentId: input.studentId,
      semester: this.currentSemesterLabel(),
      biometricToken: input.biometricToken,
    });
    return this.usersRepo.save(user);
  }

  async createLecturer(input: CreateLecturerInput): Promise<User> {
    await this.assertEmailAvailable(input.email);
    await this.assertStaffIdAvailable(input.staffId);

    const user = this.usersRepo.create({
      fullName: input.fullName,
      email: input.email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
      role: UserRole.LECTURER,
      department: input.department,
      faculty: input.faculty,
      staffId: input.staffId,
      title: 'Dr.',
      biometricToken: input.biometricToken,
    });
    return this.usersRepo.save(user);
  }

  /** Finds a user by email, studentId, or staffId — used by login. */
  async findByIdentifier(identifier: string): Promise<User | null> {
    const normalized = identifier.trim();
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:identifier)', { identifier: normalized })
      .orWhere('user.studentId = :identifier', { identifier: normalized })
      .orWhere('user.staffId = :identifier', { identifier: normalized })
      .getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async updateProfile(
    id: string,
    changes: Partial<Pick<User, 'fullName' | 'department' | 'faculty' | 'avatarUrl'>>,
  ): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, changes);
    return this.usersRepo.save(user);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  /** Computes overall attendance % across all of a student's enrollments. */
  async overallAttendancePercentage(studentId: string): Promise<number> {
    const enrollments = await this.enrollmentsRepo.find({ where: { studentId } });
    const totalHeld = enrollments.reduce((sum, e) => sum + e.classesHeld, 0);
    const totalAttended = enrollments.reduce((sum, e) => sum + e.classesAttended, 0);
    if (totalHeld === 0) return 0;
    return Math.round((totalAttended / totalHeld) * 1000) / 10;
  }

  /** Shapes a User row into the Student/Lecturer JSON the Flutter app expects. */
  async toProfile(user: User) {
    const base = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      faculty: user.faculty,
      avatarUrl: user.avatarUrl ?? null,
    };

    if (user.role === UserRole.STUDENT) {
      return {
        ...base,
        studentId: user.studentId,
        semester: user.semester,
        overallAttendancePercentage: await this.overallAttendancePercentage(user.id),
      };
    }

    return {
      ...base,
      staffId: user.staffId,
      title: user.title,
    };
  }

  private currentSemesterLabel(): string {
    const now = new Date();
    const isRainSemester = now.getMonth() >= 8 || now.getMonth() <= 1; // Sep–Jan-ish
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${isRainSemester ? 'Rain' : 'Harmattan'} Semester, ${startYear}/${startYear + 1}`;
  }

  private async assertEmailAvailable(email: string) {
    const existing = await this.usersRepo.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) throw new ConflictException('An account with this email already exists.');
  }

  private async assertStudentIdAvailable(studentId: string) {
    const existing = await this.usersRepo.findOne({ where: { studentId } });
    if (existing) throw new ConflictException('An account with this Student ID already exists.');
  }

  private async assertStaffIdAvailable(staffId: string) {
    const existing = await this.usersRepo.findOne({ where: { staffId } });
    if (existing) throw new ConflictException('An account with this Staff ID already exists.');
  }
}
