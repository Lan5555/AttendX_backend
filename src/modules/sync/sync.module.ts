import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord, Enrollment]), SessionsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
