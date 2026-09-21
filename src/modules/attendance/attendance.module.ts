import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { SessionsModule } from '../sessions/sessions.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceRecord, Enrollment]),
    SessionsModule,
    CoursesModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
