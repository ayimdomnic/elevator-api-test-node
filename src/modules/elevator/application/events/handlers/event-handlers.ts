import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { WebSocketAdapter } from '../../../infrastructure/adapters/websocket.adapter';
import { KafkaProducerAdapter } from '../../../infrastructure/adapters/kafka-producer.adapter';
import { ElevatorCalledEvent } from '../elevator-called.event';
import { ElevatorMovingEvent } from '../elevator-moved.event';
import { ElevatorMovementQueue } from '../../../infrastructure/adapters/elevator.queue';
import { RealtimeStatusService } from '../../services';
import Redis from 'ioredis';
import { ElevatorArrivedEvent } from '../elevator-arrived.event';

@EventsHandler(ElevatorCalledEvent)
@Injectable()
export class ElevatorCalledHandler implements IEventHandler<ElevatorCalledEvent> {
  private readonly logger = new Logger(ElevatorCalledHandler.name);

  constructor(
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly kafkaProducer: KafkaProducerAdapter,
    private readonly realtimeService: RealtimeStatusService,
  ) {}

  async handle(event: ElevatorCalledEvent): Promise<void> {
    this.logger.log(`Elevator ${event.elevatorId} called from ${event.fromFloor} to ${event.toFloor}`);

    // Immediate broadcast
    this.websocketAdapter.broadcast('elevator-called', {
      elevatorId: event.elevatorId,
      fromFloor: event.fromFloor,
      toFloor: event.toFloor,
      timestamp: event.timestamp,
    });

    // Trigger status update
    await this.realtimeService.triggerStatusUpdate();

    // Publish to Kafka
    await this.kafkaProducer.publish('elevator.called', event);
  }
}

@EventsHandler(ElevatorMovingEvent)
@Injectable()
export class ElevatorMovingHandler implements IEventHandler<ElevatorMovingEvent> {
  private readonly logger = new Logger(ElevatorMovingHandler.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly kafkaProducer: KafkaProducerAdapter,
    private readonly movementQueue: ElevatorMovementQueue,
    private readonly realtimeService: RealtimeStatusService,
  ) {}

  async handle(event: ElevatorMovingEvent): Promise<void> {
    this.logger.log(`Elevator ${event.elevatorId} starting movement ${event.direction} from ${event.fromFloor} to ${event.toFloor}`);

    // Update Redis state immediately
    await this.redis.hmset(`elevator:${event.elevatorId}:state`, {
      currentFloor: event.fromFloor.toString(),
      state: 'MOVING',
      direction: event.direction,
      targetFloor: event.toFloor.toString(),
      lastUpdated: event.timestamp.toISOString(),
    });

    // Start movement tracking
    await this.realtimeService.startMovementTracking(event.elevatorId);

    // Record movement start
    await this.realtimeService.recordMovement(event.elevatorId, {
      type: 'movement-started',
      fromFloor: event.fromFloor,
      toFloor: event.toFloor,
      direction: event.direction,
    });

    // Add to movement queue for actual processing
    await this.movementQueue.addMovementJob({
      elevatorId: event.elevatorId,
      fromFloor: event.fromFloor,
      toFloor: event.toFloor,
      direction: event.direction,
    });

    // Immediate WebSocket broadcast
    this.websocketAdapter.broadcast('elevator-movement-started', {
      elevatorId: event.elevatorId,
      fromFloor: event.fromFloor,
      toFloor: event.toFloor,
      direction: event.direction,
      estimatedDuration: Math.abs(event.toFloor - event.fromFloor) * 2000, // 2 seconds per floor
      timestamp: event.timestamp,
    });

    // Publish to Kafka
    await this.kafkaProducer.publish('elevator.moving', event);
  }
}

@EventsHandler(ElevatorArrivedEvent)
@Injectable()
export class ElevatorArrivedHandler implements IEventHandler<ElevatorArrivedEvent> {
  private readonly logger = new Logger(ElevatorArrivedHandler.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly kafkaProducer: KafkaProducerAdapter,
    private readonly realtimeService: RealtimeStatusService,
  ) {}

  async handle(event: ElevatorArrivedEvent): Promise<void> {
    this.logger.log(`Elevator ${event.elevatorId} arrived at floor ${event.floor}`);

    // Update Redis state
    await this.redis.hmset(`elevator:${event.elevatorId}:state`, {
      currentFloor: event.floor.toString(),
      state: 'DOORS_OPENING',
      direction: 'IDLE',
      targetFloor: '',
      lastUpdated: event.timestamp.toISOString(),
    });

    // Stop movement tracking
    await this.realtimeService.stopMovementTracking(event.elevatorId);

    // Record arrival
    await this.realtimeService.recordMovement(event.elevatorId, {
      type: 'arrived',
      floor: event.floor,
    });

    // Broadcast arrival
    this.websocketAdapter.broadcast('elevator-arrived', {
      elevatorId: event.elevatorId,
      currentFloor: event.floor,
      state: 'DOORS_OPENING',
      timestamp: event.timestamp,
    });

    // Trigger status update
    await this.realtimeService.triggerStatusUpdate();

    // Publish to Kafka
    await this.kafkaProducer.publish('elevator.arrived', event);
  }
}