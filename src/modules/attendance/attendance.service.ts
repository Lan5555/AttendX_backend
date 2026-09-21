import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { QueryRecordsDto } from './dto/query-records.dto';
import { RecordVerification, SyncStatus } from '../../common/enums/verification-status.enum';
import { SessionStatus } from '../../common/enums/session-status.enum';
import { SessionsService } from '../sessions/sessions.service';
import { SessionsGateway } from '../sessions/sessions.gateway';
import { CoursesService } from '../courses/courses.service';
import { verifyQrToken } from '../sessions/utils/totp.util';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly recordsRepo: Repository<AttendanceRecord>,
    @InjectRepository(Enrollment) private readonly enrollmentsRepo: Repository<Enrollment>,
    private readonly sessionsService: SessionsService,
    private readonly sessionsGateway: SessionsGateway,
    private readonly coursesService: CoursesService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verifies the scanned QR token against the session's rotating secret,
   * confirms the student is enrolled, then records attendance. BLE
   * proximity and liveness are accepted as booleans from the client for
   * now (see MarkAttendanceDto) — the real BLE RSSI check and the real
   * face-liveness model both plug in here, replacing the simple
   * threshold/boolean check, without changing the endpoint contract.
   */
  async markAttendance(studentId: string, dto: MarkAttendanceDto) {
    const session = await this.sessionsService.findWithSecretById(dto.sessionId);

    if (session.status !== SessionStatus.ACTIVE) {
      throw new ConflictException('This attendance session is not currently active.');
    }

    const timeStep = this.config.get<number>('attendance.qrRotationSeconds')!;
    const validWindows = this.config.get<number>('attendance.qrValidWindows')!;
    const qrValid = verifyQrToken(session.qrSecret, dto.qrToken, timeStep, validWindows);
    if (!qrValid) {
      throw new BadRequestException('QR code has expired or is invalid. Please scan again.');
    }

    const rssiThreshold = this.config.get<number>('attendance.bleProximityRssiThreshold')!;
    const bleOk = dto.bleRssi === undefined || dto.bleRssi >= rssiThreshold;
    if (!bleOk) {
      throw new BadRequestException('You appear to be too far from the lecturer. Move closer and try again.');
    }

    const livenessOk = dto.livenessConfirmed !== false;
    if (!livenessOk) {
      throw new BadRequestException('Identity verification failed. Please try again.');
    }

    const enrollment = await this.enrollmentsRepo.findOne({
      where: { courseId: session.courseId, studentId },
    });
    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course.');
    }

    const existing = await this.recordsRepo.findOne({
      where: { sessionId: session.id, studentId },
    });
    if (existing) {
      throw new ConflictException('Attendance has already been recorded for this session.');
    }

    const record = this.recordsRepo.create({
      clientRecordId: dto.clientRecordId,
      studentId,
      courseId: session.courseId,
      sessionId: session.id,
      verification: RecordVerification.VERIFIED,
      syncStatus: SyncStatus.SYNCED,
      recordedAt: new Date(),
    });
    const saved = await this.recordsRepo.save(record);

    enrollment.classesAttended += 1;
    await this.enrollmentsRepo.save(enrollment);

    const presentCount = await this.sessionsService.presentCount(session.id);
    this.sessionsGateway.emitAttendanceUpdate(session.id, {
      presentCount,
      totalStudents: session.totalStudents,
    });

    return {
      id: saved.id,
      courseCode: session.course.code,
      courseTitle: session.course.title,
      recordedAt: saved.recordedAt,
      verification: saved.verification,
      syncStatus: saved.syncStatus,
      attendancePercentage:
        enrollment.classesHeld === 0
          ? 0
          : Math.round((enrollment.classesAttended / enrollment.classesHeld) * 1000) / 10,
    };
  }

  /** A student's full attendance history, optionally scoped to one course. */
  async studentHistory(studentId: string, courseId?: string) {
    const records = await this.recordsRepo.find({
      where: courseId ? { studentId, courseId } : { studentId },
      order: { recordedAt: 'DESC' },
      take: 200,
    });
    return records.map((r) => this.toStudentRecordView(r));
  }

  /**
   * Lecturer-facing roster across recent sessions of a course: every
   * enrolled student marked present/absent per session, most recent
   * session first. Filters apply after the roster is built.
   */
  async courseRoster(courseId: string, filters: QueryRecordsDto) {
    const enrollments = await this.coursesService.listEnrollments(courseId);
    const records = await this.recordsRepo.find({
      where: { courseId },
      order: { recordedAt: 'DESC' },
      take: 500,
    });

    const bySession = new Map<string, AttendanceRecord[]>();
    for (const record of records) {
      const list = bySession.get(record.sessionId) ?? [];
      list.push(record);
      bySession.set(record.sessionId, list);
    }

    const rows: Array<{
      studentId: string;
      studentName: string;
      date: Date;
      time: string | null;
      present: boolean;
    }> = [];

    for (const [, sessionRecords] of bySession) {
      const presentStudentIds = new Set(sessionRecords.map((r) => r.studentId));
      const sessionDate = sessionRecords[0]?.recordedAt ?? new Date();

      for (const enrollment of enrollments) {
        const present = presentStudentIds.has(enrollment.studentId);
        const record = sessionRecords.find((r) => r.studentId === enrollment.studentId);
        rows.push({
          studentId: enrollment.student.studentId ?? enrollment.studentId,
          studentName: enrollment.student.fullName,
          date: record?.recordedAt ?? sessionDate,
          time: record ? this.formatTime(record.recordedAt) : null,
          present,
        });
      }
    }

    return rows
      .filter((r) => {
        if (filters.status === 'present' && !r.present) return false;
        if (filters.status === 'absent' && r.present) return false;
        if (filters.student) {
          const q = filters.student.toLowerCase();
          if (!r.studentName.toLowerCase().includes(q) && !r.studentId.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (filters.date) {
          const iso = new Date(r.date).toISOString().slice(0, 10);
          if (iso !== filters.date) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private toStudentRecordView(record: AttendanceRecord) {
    return {
      id: record.id,
      courseCode: record.course?.code,
      courseTitle: record.course?.title,
      date: record.recordedAt,
      time: this.formatTime(record.recordedAt),
      verification: record.verification,
      syncStatus: record.syncStatus,
    };
  }

  private formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
