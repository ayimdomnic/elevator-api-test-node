import { Pool } from 'pg';
import { ElevatorLog } from '../models/elevator';
import { ElevatorDirection, ElevatorStatus } from '../types';

export class ElevatorLogRepository {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async logEvent(data: {
    elevatorId: string;
    eventType: string;
    fromFloor?: number;
    toFloor?: number;
    currentFloor?: number;
    direction?: string;
    state?: string;
    metadata?: any;
    requestId?: string;
    userContext?: any;
  }): Promise<void> {
    const query = `
      INSERT INTO elevator_logs (
        elevator_id, event_type, from_floor, to_floor, current_floor,
        direction, state, metadata, request_id, user_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    const values = [
      data.elevatorId,
      data.eventType,
      data.fromFloor,
      data.toFloor,
      data.currentFloor,
      data.direction,
      data.state,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.requestId,
      data.userContext ? JSON.stringify(data.userContext) : null,
    ];
    await this.db.query(query, values);
  }

  async getLogs(filters?: {
    elevatorId?: string;
    eventType?: string;
    fromTime?: Date;
    toTime?: Date;
    limit?: number;
  }): Promise<ElevatorLog[]> {
    let query = `
      SELECT el.*, e.name as elevator_name 
      FROM elevator_logs el
      JOIN elevators e ON el.elevator_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters?.elevatorId) {
      query += ` AND el.elevator_id = $${++paramCount}`;
      params.push(filters.elevatorId);
    }

    if (filters?.eventType) {
      query += ` AND el.event_type = $${++paramCount}`;
      params.push(filters.eventType);
    }

    if (filters?.fromTime) {
      query += ` AND el.timestamp >= $${++paramCount}`;
      params.push(filters.fromTime);
    }

    if (filters?.toTime) {
      query += ` AND el.timestamp <= $${++paramCount}`;
      params.push(filters.toTime);
    }

    query += ` ORDER BY el.timestamp DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${++paramCount}`;
      params.push(filters.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(this.mapRowToElevatorLog);
  }

  private mapRowToElevatorLog(row: Record<string, unknown>): ElevatorLog {
    return {
      id: row.id as string,
      elevatorId: row.elevator_id as string,
      eventType: row.event_type as string,
      fromFloor: row.from_floor as number | undefined,
      toFloor: row.to_floor as number | undefined,
      currentFloor: row.current_floor as number | undefined,
      direction: row.direction as ElevatorDirection,
      state: row.state as ElevatorStatus | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      timestamp: row.timestamp as Date,
      requestId: row.request_id as string | undefined,
      userContext: row.user_context as Record<string, unknown> | undefined,
    };
  }
}
