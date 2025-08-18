import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('query_logs')
export class QueryLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  method: string;

  @Column()
  url: string;

  @Column({ nullable: true, name: 'user_id' })
  userId?: string;

  @Column()
  ip: string;

  @Column({ name: 'user_agent' })
  userAgent: string;

  @Column()
  duration: number;

  @Column({ name: 'sql_queries', type: 'jsonb', nullable: true })
  sqlQueries?: any[];

  @CreateDateColumn()
  timestamp: Date;
}
