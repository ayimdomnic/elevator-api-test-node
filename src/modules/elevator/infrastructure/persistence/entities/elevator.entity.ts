import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('elevators')
export class ElevatorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'current_floor', default: 0 })
  currentFloor: number;

  @Column({ default: 'IDLE' })
  state: string;

  @Column({ nullable: true, name: 'target_floor' })
  targetFloor?: number;

  @Column({ default: 'IDLE' })
  direction: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
