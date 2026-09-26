import { IsBoolean } from "class-validator";

export class LivenessDto {
    @IsBoolean()
    allowVerify!: boolean
}