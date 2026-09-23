import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AttendanceRecord } from './entities/attendance-record.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { QueryRecordsDto } from './dto/query-records.dto';

import {
  RecordVerification,
  SyncStatus,
} from '../../common/enums/verification-status.enum';
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

    @InjectRepository(Enrollment)
    private readonly enrollmentsRepo: Repository<Enrollment>,

    private readonly sessionsService: SessionsService,
    private readonly sessionsGateway: SessionsGateway,
    private readonly coursesService: CoursesService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Marks a student's attendance for an active session.
   *
   * Verification flow:
   * 1. Find the session and retrieve its secret.
   * 2. Confirm that the session is active.
   * 3. Validate the rotating QR token.
   * 4. Optionally validate BLE proximity.
   * 5. Optionally validate liveness.
   * 6. Confirm the student is enrolled.
   * 7. Prevent duplicate attendance.
   * 8. Save the attendance record.
   * 9. Update enrollment attendance count.
   * 10. Notify connected lecturer clients.
   */
  async markAttendance(
    studentId: string,
    dto: MarkAttendanceDto,
  ) {
    const session = await this.sessionsService.findWithSecretById(
      dto.sessionId,
    );

    if (session.status !== SessionStatus.ACTIVE) {
      throw new ConflictException(
        'This attendance session is not currently active.',
      );
    }

    // ---------------------------------------------------------
    // QR TOKEN VALIDATION
    // ---------------------------------------------------------

    const timeStep =
      this.config.get<number>('attendance.qrRotationSeconds') ?? 30;

    const validWindows =
      this.config.get<number>('attendance.qrValidWindows') ?? 2;

    const qrValid = verifyQrToken(
      session.qrSecret,
      dto.qrToken,
      timeStep,
      validWindows,
    );

    if (!qrValid) {
      throw new BadRequestException(
        'QR code has expired or is invalid. Please scan again.',
      );
    }

    // ---------------------------------------------------------
    // BLE PROXIMITY
    // ---------------------------------------------------------

    const requireBle =
      this.config.get<boolean>('attendance.requireBleProximity') ?? false;

    if (requireBle) {
      const rssiThreshold =
        this.config.get<number>(
          'attendance.bleProximityRssiThreshold',
        ) ?? -70;

      const bleOk =
        dto.bleRssi === undefined ||
        dto.bleRssi >= rssiThreshold;

      if (!bleOk) {
        throw new BadRequestException(
          'You appear to be too far from the lecturer. Move closer and try again.',
        );
      }
    }

    // ---------------------------------------------------------
    // LIVENESS
    // ---------------------------------------------------------

    const requireLiveness =
      this.config.get<boolean>('attendance.requireLiveness') ?? false;

    if (requireLiveness) {
      const livenessOk = dto.livenessConfirmed === true;

      if (!livenessOk) {
        throw new BadRequestException(
          'Identity verification failed. Please try again.',
        );
      }
    }

    // ---------------------------------------------------------
    // ENROLLMENT CHECK
    // ---------------------------------------------------------

    const enrollment = await this.enrollmentsRepo.findOne({
      where: {
        courseId: session.courseId,
        studentId,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        'You are not enrolled in this course.',
      );
    }

    // ---------------------------------------------------------
    // DUPLICATE / IDEMPOTENCY CHECK
    // ---------------------------------------------------------

    const existing = await this.recordsRepo.findOne({
      where: {
        sessionId: session.id,
        studentId,
      },
    });

    if (existing) {
      // Same client record = retry of the same request.
      if (existing.clientRecordId === dto.clientRecordId) {
        return this.buildRecordResponse(
          existing,
          session,
          enrollment,
        );
      }

      throw new ConflictException(
        'Attendance has already been recorded for this session.',
      );
    }

    // ---------------------------------------------------------
    // CREATE ATTENDANCE RECORD
    // ---------------------------------------------------------

    const record = this.recordsRepo.create({
      clientRecordId: dto.clientRecordId,
      studentId,
      courseId: session.courseId,
      sessionId: session.id,
      verification: RecordVerification.VERIFIED,
      syncStatus: SyncStatus.SYNCED,
      recordedAt: new Date(),
    });

    const savedRecord =
      await this.recordsRepo.save(record);

    // ---------------------------------------------------------
    // UPDATE ENROLLMENT ATTENDANCE
    // ---------------------------------------------------------

    enrollment.classesAttended += 1;

    await this.enrollmentsRepo.save(enrollment);

    // ---------------------------------------------------------
    // UPDATE LIVE SESSION
    // ---------------------------------------------------------

    const presentCount =
      await this.sessionsService.presentCount(session.id);

    this.sessionsGateway.emitAttendanceUpdate(
      session.id,
      {
        presentCount,
        totalStudents: session.totalStudents,
      },
    );

    // ---------------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------------

    return this.buildRecordResponse(
      savedRecord,
      session,
      enrollment,
    );
  }

  /**
   * Builds the response returned after attendance is marked.
   */
  private buildRecordResponse(
    record: AttendanceRecord,
    session: any,
    enrollment: Enrollment,
  ) {
    const attendancePercentage =
      enrollment.classesHeld === 0
        ? 0
        : Math.round(
            (enrollment.classesAttended /
              enrollment.classesHeld) *
              1000,
          ) / 10;

    return {
      id: record.id,
      courseCode: session.course?.code ?? '',
      courseTitle: session.course?.title ?? '',
      recordedAt: record.recordedAt,
      verification: record.verification,
      syncStatus: record.syncStatus,
      attendancePercentage,
    };
  }

  /**
   * Returns a student's attendance history.
   *
   * If courseId is provided, the history is limited
   * to that course.
   */
  async studentHistory(
    studentId: string,
    courseId?: string,
  ) {
    const records = await this.recordsRepo.find({
      where: courseId
        ? {
            studentId,
            courseId,
          }
        : {
            studentId,
          },
      relations: ['course'],
      order: {
        recordedAt: 'DESC',
      },
      take: 200,
    });

    return records.map((record) =>
      this.toStudentRecordView(record),
    );
  }

  /**
   * Returns the lecturer-facing attendance roster
   * for a course.
   */
  async courseRoster(
    courseId: string,
    filters: QueryRecordsDto,
  ) {
    const enrollments =
      await this.coursesService.listEnrollments(courseId);

    const records = await this.recordsRepo.find({
      where: {
        courseId,
      },
      order: {
        recordedAt: 'DESC',
      },
      take: 500,
    });

    // Group attendance records by session.
    const recordsBySession = new Map<
      string,
      AttendanceRecord[]
    >();

    for (const record of records) {
      const sessionRecords =
        recordsBySession.get(record.sessionId) ?? [];

      sessionRecords.push(record);

      recordsBySession.set(
        record.sessionId,
        sessionRecords,
      );
    }

    type AttendanceRow = {
      studentId: string;
      studentName: string;
      date: Date;
      time: string | null;
      present: boolean;
    };

    const rows: AttendanceRow[] = [];

    // ---------------------------------------------------------
    // BUILD SESSION ROSTER
    // ---------------------------------------------------------

    for (const sessionRecords of recordsBySession.values()) {
      const presentStudentIds = new Set(
        sessionRecords.map(
          (record) => record.studentId,
        ),
      );

      const sessionDate =
        sessionRecords[0]?.recordedAt ??
        new Date();

      for (const enrollment of enrollments) {
        const record = sessionRecords.find(
          (item) =>
            item.studentId === enrollment.studentId,
        );

        const present = presentStudentIds.has(
          enrollment.studentId,
        );

        rows.push({
          studentId:
            enrollment.student?.studentId ??
            enrollment.studentId,

          studentName:
            enrollment.student?.fullName ??
            'Unknown',

          date:
            record?.recordedAt ??
            sessionDate,

          time: record
            ? this.formatTime(record.recordedAt)
            : null,

          present,
        });
      }
    }

    // ---------------------------------------------------------
    // NO ATTENDANCE RECORDS
    // ---------------------------------------------------------

    if (recordsBySession.size === 0) {
      for (const enrollment of enrollments) {
        rows.push({
          studentId:
            enrollment.student?.studentId ??
            enrollment.studentId,

          studentName:
            enrollment.student?.fullName ??
            'Unknown',

          date: new Date(),

          time: null,

          present: false,
        });
      }
    }

    // ---------------------------------------------------------
    // FILTER RESULTS
    // ---------------------------------------------------------

    return rows
      .filter((row) => {
        if (
          filters.status === 'present' &&
          !row.present
        ) {
          return false;
        }

        if (
          filters.status === 'absent' &&
          row.present
        ) {
          return false;
        }

        if (filters.student) {
          const search =
            filters.student.toLowerCase();

          const matchesName =
            row.studentName
              .toLowerCase()
              .includes(search);

          const matchesStudentId =
            row.studentId
              .toLowerCase()
              .includes(search);

          if (
            !matchesName &&
            !matchesStudentId
          ) {
            return false;
          }
        }

        if (filters.date) {
          const rowDate =
            row.date
              .toISOString()
              .slice(0, 10);

          if (rowDate !== filters.date) {
            return false;
          }
        }

        return true;
      })
      .sort(
        (a, b) =>
          b.date.getTime() -
          a.date.getTime(),
      );
  }

  /**
   * Converts an attendance entity into the
   * student-facing response format.
   */
  private toStudentRecordView(
    record: AttendanceRecord,
  ) {
    return {
      id: record.id,
      courseCode: record.course?.code ?? '',
      courseTitle: record.course?.title ?? '',
      date: record.recordedAt,
      time: this.formatTime(record.recordedAt),
      verification: record.verification,
      syncStatus: record.syncStatus,
    };
  }

  /**
   * Formats an attendance timestamp for display.
   */
  private formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString(
      'en-US',
      {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      },
    );
  }
}