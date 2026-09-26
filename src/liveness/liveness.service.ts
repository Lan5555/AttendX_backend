import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Liveness } from './entities/liveness.entity';

@Injectable()
export class LivenessService {
    constructor(
        @InjectRepository(Liveness)
        private livenessRepository: Repository<Liveness>
){}

async updateLivenessState(allowVerify: boolean) {
    const config = await this.livenessRepository.findOne({where:{}});
    
    if (config) {
        await this.livenessRepository.update(config.id, { allowVerify });
    } else {
        await this.livenessRepository.save({ allowVerify });
    }

    return {
        success: true,
        message: 'Updated Successfully',
        data: { allowVerify }
    };
}

async checkUpdateState() {
    const res = await this.livenessRepository.findOne({where: {allowVerify: true}});
    if(!res){
       return {
        success: false,
        message: 'No liveness Data found',
        data: null
       } 
    }
    return {
        success: true,
        message: 'Data Queried successfully',
        data: {
            allowVerify: res.allowVerify
        }
    }
}

}
