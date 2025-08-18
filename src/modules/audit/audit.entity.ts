import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'audit_logs',
})
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  elevatorId: string;

  @Column()
  action: string;

  @Column({ type: 'jsonb' })
  details: Record<string, any>;

  @Column()
  initiator: string;

  @CreateDateColumn()
  createdAt: Date;
}
