import { Pool } from 'pg';
import { Elevator } from '../models/elevator';

export class ElevatorRepository {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async findOptimalElevator(targetFloor: number): Promise<Elevator | null> {
    const query = `
            SELECT * FROM elevators
            WHERE status = 'IDLE'
            ORDER BY ABS(current_floor - $1) ASC
            LIMIT 1
        `;

    const result = await this.db.query(query, [targetFloor]);
    return result.rows[0] || null;
  }

  async getElevatorById(id: string): Promise<Elevator | null> {
    const result = await this.db.query(
      'SELECT * FROM elevators WHERE id = $1',
      [id]
    );
    return result.rows.length > 0
      ? this.mapRowToElevator(result.rows[0])
      : null;
  }

  async updateElevatorTarget(
    id: string,
    targetFloor: number
  ): Promise<Elevator> {
    const query = `
      UPDATE elevators SET 
        target_floor = $1, 
        is_busy = TRUE,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.db.query(query, [targetFloor, id]);
    return this.mapRowToElevator(result.rows[0]);
  }

  async updateElevatorState(
    id: string,
    state: string,
    direction: string
  ): Promise<void> {
    await this.db.query(
      'UPDATE elevators SET state = $1, direction = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [state, direction, id]
    );
  }

  async updateElevatorFloor(id: string, floor: number): Promise<void> {
    await this.db.query(
      'UPDATE elevators SET current_floor = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [floor, id]
    );
  }

  async setElevatorIdle(id: string): Promise<void> {
    await this.db.query(
      `UPDATE elevators SET 
        state = 'IDLE', 
        direction = 'IDLE', 
        target_floor = NULL, 
        is_busy = FALSE,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1`,
      [id]
    );
  }

  async getAllElevators(): Promise<Elevator[]> {
    const result = await this.db.query('SELECT * FROM elevators ORDER BY name');
    return result.rows.map(this.mapRowToElevator);
  }

  async getElevatorStatus(id: string): Promise<Elevator> {
    const result = await this.db.query(
      'SELECT * FROM elevators WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Elevator not found');
    }
    return this.mapRowToElevator(result.rows[0]);
  }

  private mapRowToElevator(row: any): Elevator {
    return {
      id: row.id,
      name: row.name,
      currentFloor: row.current_floor,
      targetFloor: row.target_floor,
      direction: row.direction,
      status: row.status,
      isBusy: row.is_busy,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
