import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { createErrorResponse } from '../utils/response';

export class AppError extends Error {
  public name: string;
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any,
    public timestamp?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.timestamp = timestamp || new Date().toISOString();
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const logger = new Logger();
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  const timestamp = new Date().toISOString();

  logger.error('Request failed', {
    timestamp,
    error: error.message,
    stack: error.stack,
    requestId,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (error instanceof AppError) {
    return res
      .status(error.statusCode)
      .json(
        createErrorResponse(error.code, error.message, requestId, error.details)
      );
  }

  // Handle specific PostgreSQL errors
  if ('code' in error) {
    switch (error.code) {
      case '23505': // Unique constraint violation
        return res
          .status(409)
          .json(
            createErrorResponse(
              'DUPLICATE_ENTRY',
              'Resource already exists',
              requestId,
              undefined
            )
          );
      case '23503': // Foreign key violation
        return res
          .status(400)
          .json(
            createErrorResponse(
              'INVALID_REFERENCE',
              'Referenced resource does not exist',
              requestId,
              undefined
            )
          );
    }
  }

  // Default error
  res
    .status(500)
    .json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred',
        requestId,
        process.env.NODE_ENV === 'development'
          ? { stack: error.stack }
          : undefined
      )
    );
};
