import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly coursesRepo: Repository<Course>,
    @InjectRepository(Enrollment) private readonly enrollmentsRepo: Repository<Enrollment>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  async create(lecturerId: string, dto: CreateCourseDto): Promise<Course> {
    const existing = await this.coursesRepo.findOne({ where: { code: dto.code, lecturerId } });
    if (existing) {
      throw new ConflictException('You already have a course with this code.');
    }

    const course = this.coursesRepo.create({
      code: dto.code.toUpperCase(),
      title: dto.title,
      description: dto.description ?? '',
      lecturerId,
      creditUnits: dto.creditUnits,
      department: dto.department,
      scheduleDay: dto.scheduleDay,
      scheduleStartTime: dto.scheduleStartTime,
      scheduleEndTime: dto.scheduleEndTime,
      scheduleRecurringWeekly: dto.scheduleRecurringWeekly ?? true,
      venue: dto.venue,
      maxStudents: dto.maxStudents,
      attendanceThreshold: dto.attendanceThreshold ?? 75,
    });
    return this.coursesRepo.save(course);
  }

  async update(courseId: string, lecturerId: string, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.findOwnedByLecturer(courseId, lecturerId);
    Object.assign(course, dto);
    return this.coursesRepo.save(course);
  }

  async findByIdRaw(courseId: string): Promise<Course> {
    const course = await this.coursesRepo.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found.');
    return course;
  }

  async findOwnedByLecturer(courseId: string, lecturerId: string): Promise<Course> {
    const course = await this.findByIdRaw(courseId);
    if (course.lecturerId !== lecturerId) {
      throw new ForbiddenException('You do not have access to this course.');
    }
    return course;
  }

  async findLecturerCourses(lecturerId: string) {
    const courses = await this.coursesRepo.find({
      where: { lecturerId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(courses.map((c) => this.toLecturerView(c)));
  }

  async findStudentCourses(studentId: string) {
    const enrollments = await this.enrollmentsRepo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
    return enrollments.map((e) => this.toStudentView(e.course, e));
  }

  /** Role-aware single-course view: students get their own stats, lecturers get aggregate stats. */
  async findOneForUser(courseId: string, userId: string, role: UserRole) {
    const course = await this.findByIdRaw(courseId);
    if (role === UserRole.STUDENT) {
      const enrollment = await this.enrollmentsRepo.findOne({ where: { courseId, studentId: userId } });
      if (!enrollment) throw new NotFoundException('You are not enrolled in this course.');
      return this.toStudentView(course, enrollment);
    }
    if (course.lecturerId !== userId) {
      throw new ForbiddenException('You do not have access to this course.');
    }
    return this.toLecturerView(course);
  }

  async enrollStudent(courseId: string, studentIdentifier: string) {
    const course = await this.findByIdRaw(courseId);
    const student = await this.usersRepo.findOne({
      where: [{ id: studentIdentifier }, { studentId: studentIdentifier }],
    });
    if (!student || student.role !== UserRole.STUDENT) {
      throw new NotFoundException('Student not found.');
    }

    const existing = await this.enrollmentsRepo.findOne({
      where: { courseId, studentId: student.id },
    });
    if (existing) throw new ConflictException('Student is already enrolled in this course.');

    const enrollmentCount = await this.enrollmentsRepo.count({ where: { courseId } });
    if (enrollmentCount >= course.maxStudents) {
      throw new ConflictException('This course has reached its maximum number of students.');
    }

    const enrollment = this.enrollmentsRepo.create({
      courseId,
      studentId: student.id,
      classesHeld: 0,
      classesAttended: 0,
    });
    await this.enrollmentsRepo.save(enrollment);
    return this.toLecturerView(await this.findByIdRaw(courseId));
  }

  async enrolledCount(courseId: string): Promise<number> {
    return this.enrollmentsRepo.count({ where: { courseId } });
  }

  async listEnrollments(courseId: string): Promise<Enrollment[]> {
    return this.enrollmentsRepo.find({ where: { courseId }, relations: ['student'] });
  }

  private async toLecturerView(course: Course) {
    const enrollments = await this.enrollmentsRepo.find({ where: { courseId: course.id } });
    const enrolledStudents = enrollments.length;
    const avgAttendance = this.averagePercentage(enrollments);

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      lecturerName: `${course.lecturer?.title ?? 'Dr.'} ${course.lecturer?.fullName ?? ''}`.trim(),
      creditUnits: course.creditUnits,
      department: course.department,
      schedule: {
        day: course.scheduleDay,
        startTime: course.scheduleStartTime,
        endTime: course.scheduleEndTime,
        recurringWeekly: course.scheduleRecurringWeekly,
        venue: course.venue,
      },
      maxStudents: course.maxStudents,
      enrolledStudents,
      // Lecturer view aggregates classesHeld across all students' enrollment rows —
      // classesHeld should be identical across students in a course, so max() is safe.
      classesHeld: enrollments.length ? Math.max(...enrollments.map((e) => e.classesHeld)) : 0,
      classesAttended: Math.round(
        enrollments.reduce((sum, e) => sum + e.classesAttended, 0) / (enrollments.length || 1),
      ),
      attendanceThreshold: course.attendanceThreshold,
      averageAttendancePercentage: avgAttendance,
    };
  }

  private toStudentView(course: Course, enrollment: Enrollment) {
    const pct = enrollment.classesHeld === 0
      ? 0
      : Math.round((enrollment.classesAttended / enrollment.classesHeld) * 1000) / 10;

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      lecturerName: `${course.lecturer?.title ?? 'Dr.'} ${course.lecturer?.fullName ?? ''}`.trim(),
      creditUnits: course.creditUnits,
      department: course.department,
      schedule: {
        day: course.scheduleDay,
        startTime: course.scheduleStartTime,
        endTime: course.scheduleEndTime,
        recurringWeekly: course.scheduleRecurringWeekly,
        venue: course.venue,
      },
      maxStudents: course.maxStudents,
      classesHeld: enrollment.classesHeld,
      classesAttended: enrollment.classesAttended,
      classesMissed: enrollment.classesHeld - enrollment.classesAttended,
      attendanceThreshold: course.attendanceThreshold,
      attendancePercentage: pct,
      eligibility: this.eligibility(pct, course.attendanceThreshold),
    };
  }

  private averagePercentage(enrollments: Enrollment[]): number {
    if (enrollments.length === 0) return 0;
    const total = enrollments.reduce((sum, e) => {
      const pct = e.classesHeld === 0 ? 0 : (e.classesAttended / e.classesHeld) * 100;
      return sum + pct;
    }, 0);
    return Math.round((total / enrollments.length) * 10) / 10;
  }

  private eligibility(percentage: number, threshold: number): 'eligible' | 'atRisk' | 'ineligible' {
    if (percentage >= threshold) return 'eligible';
    if (percentage >= threshold - 15) return 'atRisk';
    return 'ineligible';
  }

  async findAllCourses(){
    const courses = await this.coursesRepo.find();
    if(courses){
      return courses
    }
  }
}
