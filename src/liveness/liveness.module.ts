import { Module } from '@nestjs/common';
import { LivenessService } from './liveness.service';
import { LivenessController } from './liveness.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Liveness } from './entities/liveness.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Liveness])],
  controllers: [LivenessController],
  providers: [LivenessService],
})
export class LivenessModule {}
