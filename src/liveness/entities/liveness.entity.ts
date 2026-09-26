import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('liveness')
export class Liveness {
 @PrimaryGeneratedColumn()
 id!: number
 @Column({default: true})
 allowVerify!: boolean;
}