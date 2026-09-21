import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('sessions')
@ApiBearerAuth()
@Roles(UserRole.LECTURER)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('today')
  @ApiOperation({ summary: "Today's sessions for the lecturer's courses" })
  today(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findTodaySessionsForLecturer(user.id);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start (or resume) a live attendance session for a course' })
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartSessionDto) {
    return this.sessionsService.startSession(user.id, dto.courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a session (with live present count)' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const session = await this.sessionsService.findOwned(id, user.id);
    const presentCount = await this.sessionsService.presentCount(id);
    return { ...session, presentCount };
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Get the current rotating QR token for a session' })
  qr(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.qrToken(user.id, id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause attendance capture for a session' })
  pause(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.pauseSession(user.id, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused session' })
  resume(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.resumeSession(user.id, id);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End a session and get the attendance summary' })
  end(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.endSession(user.id, id);
  }
}
