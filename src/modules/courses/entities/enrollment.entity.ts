import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Course } from './course.entity';

/**
 * Join table between a Student and a Course. classesHeld/classesAttended
 * are denormalized counters, updated whenever a session ends / an
 * attendance record is created — cheap reads for the dashboard & course
 * cards, at the cost of updating two places on write (see
 * AttendanceService.markAttendance and SessionsService.endSession).
 */
@Entity('enrollments')
@Unique(['studentId', 'courseId'])
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.enrollments)
  @JoinColumn({ name: 'studentId' })
  student!: User;

  @Column()
  studentId!: string;

  @ManyToOne(() => Course, (course) => course.enrollments, { eager: true })
  @JoinColumn({ name: 'courseId' })
  course!: Course;

  @Column()
  courseId!: string;

  @Column({ default: 0 })
  classesHeld!: number;

  @Column({ default: 0 })
  classesAttended!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
