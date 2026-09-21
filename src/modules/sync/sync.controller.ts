import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('attendance')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Batch-sync attendance records that were saved offline on the device' })
  sync(@CurrentUser() user: AuthenticatedUser, @Body() dto: SyncAttendanceDto) {
    return this.syncService.syncAttendance(user.id, dto.records);
  }
}
