import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [AttendanceModule, CoursesModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
