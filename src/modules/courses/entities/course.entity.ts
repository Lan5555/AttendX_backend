import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Enrollment } from './enrollment.entity';
import { AttendanceSession } from '../../sessions/entities/attendance-session.entity';

/**
 * Course + its weekly schedule (kept flat on this table rather than a
 * separate CourseSchedule entity — a course has exactly one recurring
 * schedule in this MVP, so normalizing it out would just add a join
 * every list/detail query pays for with no benefit yet).
 */
@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  code!: string; // e.g. "CSC 416"

  @Column()
  title!: string;

  @Column({ default: '' })
  description!: string;

  @ManyToOne(() => User, (user) => user.coursesTaught, { eager: true })
  @JoinColumn({ name: 'lecturerId' })
  lecturer!: User;

  @Column()
  lecturerId!: string;

  @Column({ default: 3 })
  creditUnits!: number;

  @Column({ default: '' })
  department!: string;

  // --- Schedule ---
  @Column()
  scheduleDay!: string; // "Monday"

  @Column()
  scheduleStartTime!: string; // "10:00 AM"

  @Column()
  scheduleEndTime!: string; // "12:00 PM"

  @Column({ default: true })
  scheduleRecurringWeekly!: boolean;

  @Column()
  venue!: string;

  @Column({ default: 100 })
  maxStudents!: number;

  @Column({ default: 75 })
  attendanceThreshold!: number;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
  enrollments!: Enrollment[];

  @OneToMany(() => AttendanceSession, (session) => session.course)
  sessions!: AttendanceSession[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
