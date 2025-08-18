import { Pool } from 'pg';
import { Logger } from '../utils/logger';

export class QueryLoggingService {
  private db: Pool;
  private logger: Logger;

  constructor(db: Pool, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  async logSQLQuery(
    queryText: string,
    params: unknown[],
    executionTimeMs: number,
    context: {
      userId?: string;
      endpoint?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO query_logs (
          query_text, query_params, execution_time_ms,
          user_id, endpoint, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      const values = [
        queryText,
        JSON.stringify(params),
        executionTimeMs,
        context.userId,
        context.endpoint,
        context.ipAddress,
        context.userAgent,
      ];
      await this.db.query(query, values);
    } catch (error) {
      this.logger.error('Failed to log SQL query', {
        error: (error as Error).message,
        queryText: queryText.substring(0, 100) + '...',
      });
    }
  }
}
