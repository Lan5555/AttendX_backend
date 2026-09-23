import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AttendanceSession } from './entities/attendance-session.entity';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { SessionStatus } from '../../common/enums/session-status.enum';
import {
  generateQrToken,
  generateSessionSecret,
  secondsUntilNextRotation,
} from './utils/totp.util';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessionsRepo: Repository<AttendanceSession>,
    @InjectRepository(Course) private readonly coursesRepo: Repository<Course>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepo: Repository<Enrollment>,
    @InjectRepository(AttendanceRecord)
    private readonly recordsRepo: Repository<AttendanceRecord>,
    private readonly config: ConfigService,
  ) {}

  // ────────────────────────────────────────────────────────────────────
  // START
  // ────────────────────────────────────────────────────────────────────
  async startSession(lecturerId: string, courseId: string) {
    const course = await this.coursesRepo.findOne({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('Course not found.');
    if (course.lecturerId !== lecturerId) {
      throw new ForbiddenException('You do not have access to this course.');
    }

    // Resume if already active.
    const alreadyActive = await this.sessionsRepo.findOne({
      where: { courseId, status: SessionStatus.ACTIVE },
      relations: ['course'],
    });
    if (alreadyActive) return this.toPublic(alreadyActive);

    const totalStudents = await this.enrollmentsRepo.count({
      where: { courseId },
    });

    const session = this.sessionsRepo.create({
      courseId,
      status: SessionStatus.ACTIVE,
      qrSecret: generateSessionSecret(),
      totalStudents,
      startedAt: new Date(),
    });
    const saved = await this.sessionsRepo.save(session);

    // Reload with the course relation so toPublic can flatten fields.
    const reloaded = await this.sessionsRepo.findOne({
      where: { id: saved.id },
      relations: ['course'],
    });
    return this.toPublic(reloaded!);
  }

  // ────────────────────────────────────────────────────────────────────
  // PAUSE / RESUME
  // ────────────────────────────────────────────────────────────────────
  async pauseSession(lecturerId: string, sessionId: string) {
    const session = await this.findOwned(sessionId, lecturerId);
    session.status = SessionStatus.PAUSED;
    session.pausedAt = new Date();
    const saved = await this.sessionsRepo.save(session);

    const reloaded = await this.sessionsRepo.findOne({
      where: { id: saved.id },
      relations: ['course'],
    });
    return this.toPublic(reloaded!);
  }

  async resumeSession(lecturerId: string, sessionId: string) {
    const session = await this.findOwned(sessionId, lecturerId);
    session.status = SessionStatus.ACTIVE;
    session.pausedAt = undefined;
    const saved = await this.sessionsRepo.save(session);

    const reloaded = await this.sessionsRepo.findOne({
      where: { id: saved.id },
      relations: ['course'],
    });
    return this.toPublic(reloaded!);
  }

  // ────────────────────────────────────────────────────────────────────
  // END
  // ────────────────────────────────────────────────────────────────────
  /**
   * Ends the session and bumps `classesHeld` for every enrolled student
   * (whether or not they attended) — this is what drives the course's
   * attendance-percentage denominator going forward.
   */
  async endSession(lecturerId: string, sessionId: string) {
    const session = await this.findOwned(sessionId, lecturerId);
    if (session.status === SessionStatus.COMPLETED) {
      return this.summary(session);
    }

    session.status = SessionStatus.COMPLETED;
    session.endedAt = new Date();
    await this.sessionsRepo.save(session);

    await this.enrollmentsRepo
      .createQueryBuilder()
      .update(Enrollment)
      .set({ classesHeld: () => '"classesHeld" + 1' })
      .where('courseId = :courseId', { courseId: session.courseId })
      .execute();

    return this.summary(session);
  }

  // ────────────────────────────────────────────────────────────────────
  // LOOKUPS
  // ────────────────────────────────────────────────────────────────────
  async findById(sessionId: string): Promise<AttendanceSession> {
    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId },
      relations: ['course'],
    });
    if (!session) throw new NotFoundException('Session not found.');
    return session;
  }

  async findOwned(
    sessionId: string,
    lecturerId: string,
  ): Promise<AttendanceSession> {
    const session = await this.findById(sessionId);
    if (session.course.lecturerId !== lecturerId) {
      throw new ForbiddenException('You do not have access to this session.');
    }
    return session;
  }

  /**
   * Sessions for courses the lecturer teaches that are either scheduled
   * for today's weekday OR have a live (active) session right now.
   */
  async findTodaySessionsForLecturer(lecturerId: string) {
    const weekday = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
    });

    // All courses taught by this lecturer.
    const allCourses = await this.coursesRepo.find({
      where: { lecturerId },
    });

    // Courses with an active session right now, regardless of schedule.
    const activeSessions = await this.sessionsRepo.find({
      where: { status: SessionStatus.ACTIVE },
      relations: ['course'],
    });

    const activeCourseIds = new Set(
      activeSessions
        .filter((s) => s.course.lecturerId === lecturerId)
        .map((s) => s.courseId),
    );

    // Today's list = scheduled-today OR has-active-session.
    const courses = allCourses.filter(
      (c) => c.scheduleDay === weekday || activeCourseIds.has(c.id),
    );

    const sessions = await Promise.all(
      courses.map(async (course) => {
        const active = await this.sessionsRepo.findOne({
          where: { courseId: course.id, status: SessionStatus.ACTIVE },
        });

        const totalStudents = await this.enrollmentsRepo.count({
          where: { courseId: course.id },
        });

        const presentCount = active ? await this.presentCount(active.id) : 0;

        return {
          id: active?.id ?? null,
          courseId: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          timeRangeLabel: `${course.scheduleStartTime} – ${course.scheduleEndTime}`,
          venue: course.venue,
          totalStudents,
          presentCount,
          status: active?.status ?? SessionStatus.UPCOMING,
        };
      }),
    );

    return sessions;
  }

  // ────────────────────────────────────────────────────────────────────
  // QR TOKEN
  // ────────────────────────────────────────────────────────────────────
  /**
   * Returns the current rotating QR payload for a session. The payload
   * is a JSON string containing both `sessionId` and `token`, so the
   * student's scanner has everything needed to POST /attendance/mark.
   */
  async qrToken(lecturerId: string, sessionId: string) {
    const session = await this.findOwnedWithSecret(sessionId, lecturerId);
    if (session.status !== SessionStatus.ACTIVE) {
      throw new ConflictException(
        'QR codes are only available while the session is active.',
      );
    }

    const timeStep =
      this.config.get<number>('attendance.qrRotationSeconds') ?? 30;
    const token = generateQrToken(session.qrSecret, timeStep);

    // The QR image encodes this JSON. The student's app parses it to
    // extract sessionId + token, then sends them in the POST body.
    const qrPayload = JSON.stringify({
      sessionId: session.id,
      token,
    });
    console.log('GEN secret:', session.qrSecret, 'token:', token);

    return {
      token,
      qrPayload,
      secondsUntilRefresh: secondsUntilNextRotation(timeStep),
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // SECRET ACCESS
  // ────────────────────────────────────────────────────────────────────
  /** Includes the normally-hidden qrSecret column — for internal use only. */
  async findOwnedWithSecret(
    sessionId: string,
    lecturerId: string,
  ): Promise<AttendanceSession> {
    const session = await this.sessionsRepo
      .createQueryBuilder('session')
      .addSelect('session.qrSecret')
      .leftJoinAndSelect('session.course', 'course')
      .where('session.id = :sessionId', { sessionId })
      .getOne();
    if (!session) throw new NotFoundException('Session not found.');
    if (session.course.lecturerId !== lecturerId) {
      throw new ForbiddenException('You do not have access to this session.');
    }
    return session;
  }

  /** Internal: fetch the raw secret for verifying a student's scanned token. */
  async findWithSecretById(sessionId: string): Promise<AttendanceSession> {
    const session = await this.sessionsRepo
      .createQueryBuilder('session')
      .addSelect('session.qrSecret')
      .leftJoinAndSelect('session.course', 'course')
      .where('session.id = :sessionId', { sessionId })
      .getOne();
    if (!session) throw new NotFoundException('Session not found.');
    return session;
  }

  async presentCount(sessionId: string): Promise<number> {
    return this.recordsRepo.count({ where: { sessionId } });
  }

  // ────────────────────────────────────────────────────────────────────
  // SERIALIZATION
  // ────────────────────────────────────────────────────────────────────
  /** Strips qrSecret and flattens course fields for the client. */
  private toPublic(session: AttendanceSession) {
    const { qrSecret, course, ...rest } = session as any;
    return {
      ...rest,
      courseCode: course?.code ?? '',
      courseTitle: course?.title ?? '',
      timeRangeLabel: course
        ? `${course.scheduleStartTime} – ${course.scheduleEndTime}`
        : '',
      venue: course?.venue ?? '',
    };
  }

  private async summary(session: AttendanceSession) {
    const present = await this.presentCount(session.id);
    const total = session.totalStudents;
    return {
      id: session.id,
      courseId: session.courseId,
      status: session.status,
      totalStudents: total,
      presentCount: present,
      absentCount: total - present,
      attendanceRate:
        total === 0 ? 0 : Math.round((present / total) * 1000) / 10,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  }
}