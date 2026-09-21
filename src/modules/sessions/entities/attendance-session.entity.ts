import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SessionStatus } from '../../../common/enums/session-status.enum';
import { Course } from '../../courses/entities/course.entity';
import { AttendanceRecord } from '../../attendance/entities/attendance-record.entity';

/**
 * A single live attendance-taking window for a course. `qrSecret` is a
 * per-session random secret used to derive a rotating QR token (see
 * sessions/utils/totp.util.ts) — never sent to clients directly, only
 * the derived token is exposed via GET /sessions/:id/qr.
 */
@Entity('attendance_sessions')
export class AttendanceSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Course, (course) => course.sessions, { eager: true })
  @JoinColumn({ name: 'courseId' })
  course!: Course;

  @Column()
  courseId!: string;

  @Column({ type: 'varchar', default: SessionStatus.UPCOMING })
  status!: SessionStatus;

  @Column({ select: false })
  qrSecret!: string;

  @Column({ default: 0 })
  totalStudents!: number;

  @OneToMany(() => AttendanceRecord, (record) => record.session)
  records!: AttendanceRecord[];

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  pausedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
