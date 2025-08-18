import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { createErrorResponse } from '../utils/response';
import { Logger } from '../utils/logger';

export const validateElevatorCall = (logger: Logger) => [
  body('fromFloor')
    .isInt({ min: 1, max: 50 })
    .withMessage('fromFloor must be an integer between 1 and 50'),
  body('toFloor')
    .isInt({ min: 1, max: 50 })
    .withMessage('toFloor must be an integer between 1 and 50'),
  body('elevatorId')
    .optional()
    .isUUID()
    .withMessage('elevatorId must be a valid UUID'),
  handleValidationErrors,
];

export const validateElevatorId = (logger: Logger) => [
  param('elevatorId').isUUID().withMessage('elevatorId must be a valid UUID'),
  handleValidationErrors,
];

export const validateLogFilters = (logger: Logger) => [
  query('elevatorId')
    .optional()
    .isUUID()
    .withMessage('elevatorId must be a valid UUID'),
  query('eventType')
    .optional()
    .isIn([
      'CALL_REQUESTED',
      'FLOOR_CHANGED',
      'DOORS_OPENING',
      'DOORS_CLOSING',
      'ELEVATOR_IDLE',
    ])
    .withMessage('eventType must be a valid event type'),
  query('fromTime')
    .optional()
    .isISO8601()
    .withMessage('fromTime must be a valid ISO8601 date'),
  query('toTime')
    .optional()
    .isISO8601()
    .withMessage('toTime must be a valid ISO8601 date'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('limit must be an integer between 1 and 1000'),
  handleValidationErrors,
];

function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction,
  logger: Logger
) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    logger.warn('Validation failed', { requestId, errors: errors.array() });
    return res.status(400).json(
      createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid request data',
        requestId,
        {
          fields: errors.array(),
        }
      )
    );
  }
  next();
}
