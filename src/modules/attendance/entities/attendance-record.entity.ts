import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import {
  RecordVerification,
  SyncStatus,
} from '../../../common/enums/verification-status.enum';
import { User } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';
import { AttendanceSession } from '../../sessions/entities/attendance-session.entity';

/**
 * One student's attendance for one session. `clientRecordId` is the
 * UUID the mobile app generates client-side (offline-first) so that a
 * record created offline and later synced via POST /sync/attendance is
 * idempotent — replaying the same sync twice never creates duplicates.
 */
@Entity('attendance_records')
@Unique(['studentId', 'sessionId'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  clientRecordId?: string;

  @ManyToOne(() => User, (user) => user.attendanceRecords, { eager: true })
  @JoinColumn({ name: 'studentId' })
  student!: User;

  @Column()
  studentId!: string;

  @ManyToOne(() => Course, { eager: true })
  @JoinColumn({ name: 'courseId' })
  course!: Course;

  @Column()
  courseId!: string;

  @ManyToOne(() => AttendanceSession, (session) => session.records)
  @JoinColumn({ name: 'sessionId' })
  session!: AttendanceSession;

  @Column()
  sessionId!: string;

  @Column({ type: 'varchar', default: RecordVerification.VERIFIED })
  verification!: RecordVerification;

  @Column({ type: 'varchar', default: SyncStatus.SYNCED })
  syncStatus!: SyncStatus;

  @CreateDateColumn()
  recordedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
