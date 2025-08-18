import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryLogEntity } from './entities';

@Injectable()
export class QueryLoggerService {
  constructor(
    @InjectRepository(QueryLogEntity)
    private readonly queryLogRepository: Repository<QueryLogEntity>,
  ) {}

  async logQuery(logData: {
    method: string;
    url: string;
    userId?: string;
    ip: string;
    userAgent: string;
    duration: number;
    timestamp: Date;
  }): Promise<void> {
    // console.log("LogData ->", logData);
    const logEntry = this.queryLogRepository.create(logData);
    // console.log("LogEntry ->", logEntry);
    await this.queryLogRepository.save(logEntry);
  }

  async getQueryLogs(filters: {
    userId?: string;
    method?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const query = this.queryLogRepository.createQueryBuilder('log');

    if (filters.userId) {
      query.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    if (filters.method) {
      query.andWhere('log.method = :method', { method: filters.method });
    }
    if (filters.startDate) {
      query.andWhere('log.timestamp >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      query.andWhere('log.timestamp <= :endDate', { endDate: filters.endDate });
    }

    return query
      .orderBy('log.timestamp', 'DESC')
      .limit(filters.limit || 100)
      .getMany();
  }
}
