import { Body, Controller, Get, Patch } from '@nestjs/common';
import { LivenessService } from './liveness.service';
import { LivenessDto } from './dto/liveness.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('liveness')
export class LivenessController {
  constructor(private readonly livenessService: LivenessService) {}
  @Patch('/update-current-state')
  @Public()
  async updateLivenessState(@Body() body: LivenessDto){
    return await this.livenessService.updateLivenessState(body.allowVerify);
  }

  @Get('/check-current-state')
  @Public()
  async checkLivenessState(){
    return await this.livenessService.checkUpdateState();
  }
}
