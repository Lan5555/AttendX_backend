import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService, ExportFormat } from './export.service';
import { CoursesService } from '../courses/courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('export')
@ApiBearerAuth()
@Roles(UserRole.LECTURER)
@Controller('export')
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly coursesService: CoursesService,
  ) {}

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Download a CSV or Excel attendance export for a course (lecturer only)' })
  async export(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'csv',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.coursesService.findOwnedByLecturer(courseId, user.id);
    const { buffer, fileName, contentType } = await this.exportService.generate(
      courseId,
      format,
      startDate,
      endDate,
    );

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
