import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { AppError } from './error.handler';

export const idempotencyMiddleware = (db: Pool, logger: Logger) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    if (!idempotencyKey || req.method === 'GET') {
      return next();
    }

    try {
      const result = await db.query(
        'SELECT response_body, response_status FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()',
        [idempotencyKey]
      );

      if (result.rows.length > 0) {
        const { response_body, response_status } = result.rows[0];
        logger.info('Returning cached idempotent response', {
          idempotencyKey,
          timestamp: new Date().toISOString(),
        });
        return res.status(response_status).json(JSON.parse(response_body));
      }

      await db.query(
        `INSERT INTO idempotency_keys (key, expires_at) 
         VALUES ($1, NOW() + INTERVAL '1 hour') 
         ON CONFLICT (key) DO NOTHING`,
        [idempotencyKey]
      );

      const originalSend = res.send;
      res.send = function (body) {
        db.query(
          'UPDATE idempotency_keys SET response_body = $1, response_status = $2 WHERE key = $3',
          [body, res.statusCode, idempotencyKey]
        ).catch(err =>
          logger.error('Failed to store idempotent response', {
            error: err.message,
            idempotencyKey,
            timestamp: new Date().toISOString(),
          })
        );
        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Idempotency middleware error', {
        error: (error as Error).message,
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });
      next(
        new AppError(
          500,
          'IDEMPOTENCY_ERROR',
          'Failed to process idempotency key'
        )
      );
    }
  };
};
