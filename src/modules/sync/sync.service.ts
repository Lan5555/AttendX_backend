import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { RecordVerification, SyncStatus } from '../../common/enums/verification-status.enum';
import { SessionsService } from '../sessions/sessions.service';
import { OfflineAttendanceRecordDto } from './dto/sync-attendance.dto';

/**
 * Persists attendance that was verified on-device (QR + BLE + liveness
 * all already passed in the mobile app's flow) while the device had no
 * connection. Idempotent on `clientRecordId` — replaying the same batch
 * twice (e.g. a retried request) never creates duplicates.
 *
 * Note: this intentionally does NOT re-check the QR token, since by the
 * time a record syncs the session's rotating token has long since moved
 * on. A production system handling this offline path at scale would
 * want a signed, timestamped proof captured at verification time (e.g.
 * a JWT minted by the lecturer's device) so the server can verify the
 * *original* scan was legitimate, rather than trusting the client's
 * "I verified this" claim — flagged here for the next iteration.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly recordsRepo: Repository<AttendanceRecord>,
    @InjectRepository(Enrollment) private readonly enrollmentsRepo: Repository<Enrollment>,
    private readonly sessionsService: SessionsService,
  ) {}

  async syncAttendance(studentId: string, records: OfflineAttendanceRecordDto[]) {
    const results: Array<{ clientRecordId: string; status: 'synced' | 'duplicate' | 'failed'; reason?: string }> = [];

    for (const item of records) {
      try {
        const existing = await this.recordsRepo.findOne({
          where: { clientRecordId: item.clientRecordId },
        });
        if (existing) {
          results.push({ clientRecordId: item.clientRecordId, status: 'duplicate' });
          continue;
        }

        const session = await this.sessionsService.findById(item.sessionId);
        const enrollment = await this.enrollmentsRepo.findOne({
          where: { courseId: session.courseId, studentId },
        });
        if (!enrollment) {
          results.push({
            clientRecordId: item.clientRecordId,
            status: 'failed',
            reason: 'Not enrolled in this course.',
          });
          continue;
        }

        const alreadyPresent = await this.recordsRepo.findOne({
          where: { sessionId: session.id, studentId },
        });
        if (alreadyPresent) {
          results.push({ clientRecordId: item.clientRecordId, status: 'duplicate' });
          continue;
        }

        const record = this.recordsRepo.create({
          clientRecordId: item.clientRecordId,
          studentId,
          courseId: session.courseId,
          sessionId: session.id,
          verification: RecordVerification.VERIFIED,
          syncStatus: SyncStatus.SYNCED,
          recordedAt: new Date(item.recordedAt),
        });
        await this.recordsRepo.save(record);

        enrollment.classesAttended += 1;
        await this.enrollmentsRepo.save(enrollment);

        results.push({ clientRecordId: item.clientRecordId, status: 'synced' });
      } catch (err) {
        this.logger.warn(`Failed to sync record ${item.clientRecordId}: ${err}`);
        results.push({ clientRecordId: item.clientRecordId, status: 'failed', reason: 'Session not found.' });
      }
    }

    return { synced: results.filter((r) => r.status === 'synced').length, results };
  }
}
