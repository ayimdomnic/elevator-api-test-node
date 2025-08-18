import { Request, Response, NextFunction } from 'express';
import { ElevatorCallService } from '../services/elevator-call.service';
import { ElevatorStatusService } from '../services/elevator-status.service';
import { ElevatorLogService } from '../services/elevator-log.service';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import { Logger } from '../utils/logger';

export class ElevatorController {
  private callService: ElevatorCallService;
  private statusService: ElevatorStatusService;
  private logService: ElevatorLogService;
  private logger: Logger;
  constructor(
    callService: ElevatorCallService,
    statusService: ElevatorStatusService,
    logService: ElevatorLogService,
    logger: Logger
  ) {
    this.callService = callService;
    this.statusService = statusService;
    this.logService = logService;
    this.logger = logger;
  }

  async callElevator(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromFloor, toFloor, elevatorId } = req.body;
      const requestId =
        (req.headers['x-request-id'] as string) || this.generateRequestId();

      if (!fromFloor || !toFloor) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              'VALIDATION_ERROR',
              'fromFloor and toFloor are required',
              requestId
            )
          );
      }

      if (fromFloor === toFloor) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              'VALIDATION_ERROR',
              'fromFloor and toFloor must be different',
              requestId
            )
          );
      }

      const result = await this.callService.callElevator(
        { fromFloor, toFloor, elevatorId },
        requestId
      );

      this.logger.info('Elevator called successfully', {
        fromFloor,
        toFloor,
        elevatorId: result.elevator.id,
        requestId,
      });

      res
        .status(200)
        .json(
          createSuccessResponse(
            result,
            requestId,
            'Elevator called successfully'
          )
        );
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { elevatorId } = req.params;
      const requestId =
        (req.headers['x-request-id'] as string) || this.generateRequestId();

      const elevators = await this.statusService.getElevatorStatus(elevatorId);

      res
        .status(200)
        .json(
          createSuccessResponse(
            elevators,
            requestId,
            'Elevator status retrieved successfully'
          )
        );
    } catch (error) {
      next(error);
    }
  }

  async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const requestId =
        (req.headers['x-request-id'] as string) || this.generateRequestId();
      const filters = {
        elevatorId: req.query.elevatorId as string,
        eventType: req.query.eventType as string,
        fromTime: req.query.fromTime
          ? new Date(req.query.fromTime as string)
          : undefined,
        toTime: req.query.toTime
          ? new Date(req.query.toTime as string)
          : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      };

      const logs = await this.logService.getLogs(filters);

      res
        .status(200)
        .json(
          createSuccessResponse(logs, requestId, 'Logs retrieved successfully')
        );
    } catch (error) {
      next(error);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
