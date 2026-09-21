import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { AttendanceRecord } from '../../attendance/entities/attendance-record.entity';

/**
 * Single table for both Student and Lecturer accounts, distinguished by
 * `role`. Role-specific fields (studentId/semester vs staffId/title) are
 * nullable rather than split into separate tables — simpler to query for
 * an MVP, and mirrors the Flutter app's Student/Lecturer split at the
 * DTO layer (see users.service.ts `toProfile`).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fullName!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  @Column({ select: false })
  passwordHash!: string;

  @Column({ type: 'varchar' })
  role!: UserRole;

  @Column({ default: '' })
  department!: string;

  @Column({ default: '' })
  faculty!: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  // Student-only fields
  @Column({ nullable: true })
  studentId?: string;

  @Column({ nullable: true })
  semester?: string;

  // Lecturer-only fields
  @Column({ nullable: true })
  staffId?: string;

  @Column({ nullable: true, default: 'Dr.' })
  title?: string;

  @Column()
  biometricToken!: string;

  @OneToMany(() => Course, (course) => course.lecturer)
  coursesTaught!: Course[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments!: Enrollment[];

  @OneToMany(() => AttendanceRecord, (record) => record.student)
  attendanceRecords!: AttendanceRecord[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
