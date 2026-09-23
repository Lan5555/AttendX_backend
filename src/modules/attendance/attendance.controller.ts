import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { QueryRecordsDto } from './dto/query-records.dto';
import { CoursesService } from '../courses/courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly coursesService: CoursesService,
  ) {}

  @Post('mark')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Mark attendance for the current student (QR + BLE + liveness verified server-side)' })
  mark(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markAttendance(user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: "The current student's attendance history" })
  myHistory(@CurrentUser() user: AuthenticatedUser, @Query('courseId') courseId?: string) {
    return this.attendanceService.studentHistory(user.id, courseId);
  }

  @Get('course/:courseId')
  @Roles(UserRole.LECTURER)
  @ApiOperation({ summary: 'Attendance roster for a course (lecturer only, own courses), filterable by date/student/status' })
  async courseRecords(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: QueryRecordsDto,
  ) {
    await this.coursesService.findOwnedByLecturer(courseId, user.id);
    return this.attendanceService.courseRoster(courseId, filters);
  }
}
