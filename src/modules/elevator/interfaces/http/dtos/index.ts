// src/modules/elevator/interfaces/http/dtos/call-elevator.dto.ts
import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CallElevatorDto {
    @ApiProperty({ 
      description: 'Floor to call elevator from', 
      minimum: 0, 
      maximum: 100,
      example: 5
    })
    @IsInt()
    @Min(0)
    @Max(100)
    @Transform(({ value }) => parseInt(value, 10))
    fromFloor: number;
  
    @ApiProperty({ 
      description: 'Destination floor', 
      minimum: 0, 
      maximum: 100,
      example: 10
    })
    @IsInt()
    @Min(0)
    @Max(100)
    @Transform(({ value }) => parseInt(value, 10))
    toFloor: number;
  
    @ApiProperty({ 
      description: 'User ID making the call', 
      required: false,
      example: 'user-123'
    })
    @IsOptional()
    @IsString()
    userId?: string;
  }

export class ElevatorStatusDto {
    @ApiProperty({
      description: 'Unique identifier of the elevator',
      example: 'elevator-1'
    })
    elevatorId: string;
  
    @ApiProperty({
      description: 'Current floor of the elevator',
      example: 5
    })
    currentFloor: number;
  
    @ApiProperty({
      description: 'Current state of the elevator',
      enum: ['IDLE', 'MOVING', 'DOORS_OPENING', 'DOORS_CLOSING', 'MAINTENANCE'],
      example: 'IDLE'
    })
    state: string;
  
    @ApiProperty({
      description: 'Current direction of the elevator',
      enum: ['UP', 'DOWN', 'IDLE'],
      example: 'IDLE'
    })
    direction: string;
  
    @ApiProperty({
      description: 'Target floor if elevator is moving',
      required: false,
      example: 10
    })
    targetFloor?: number;
  
    @ApiProperty({
      description: 'Timestamp of last status update',
      example: '2023-05-15T10:00:00.000Z'
    })
    lastUpdated: Date;
  }

  export class ElevatorLogsDto {
    @ApiProperty({
      description: 'Unique identifier of the log entry',
      example: '123e4567-e89b-12d3-a456-426614174000'
    })
    id: string;
  
    @ApiProperty({
      description: 'Elevator ID associated with the log',
      example: 'elevator-1'
    })
    elevatorId: string;
  
    @ApiProperty({
      description: 'Type of event',
      example: 'ElevatorCalledEvent'
    })
    eventType: string;
  
    @ApiProperty({
      description: 'Event payload data',
      type: Object,
      example: {
        fromFloor: 5,
        toFloor: 10,
        timestamp: '2023-05-15T10:00:00.000Z'
      }
    })
    payload: any;
  
    @ApiProperty({
      description: 'Timestamp when the event occurred',
      example: '2023-05-15T10:00:00.000Z'
    })
    timestamp: Date;
  
    @ApiProperty({
      description: 'Sequence number of the event',
      example: 42
    })
    sequenceNumber: number;
  }

  export class InitializeElevatorDto {
    @ApiProperty({
      description: 'Initial floor for the elevator',
      minimum: 0,
      maximum: 100,
      required: false,
      example: 0
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    @Transform(({ value }) => value !== undefined ? parseInt(value, 10) : undefined)
    initialFloor?: number;
  }