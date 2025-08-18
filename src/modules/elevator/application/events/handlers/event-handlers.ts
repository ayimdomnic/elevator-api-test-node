
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { WebSocketAdapter } from '../../../infrastructure/adapters/websocket.adapter';
import { KafkaProducerAdapter } from '../../../infrastructure/adapters/kafka-producer.adapter';
import { ElevatorCalledEvent } from '../elevator-called.event';
import { ElevatorMovingEvent } from '../elevator-moved.event';
import { ElevatorMovementQueue } from '../../../infrastructure/adapters/elevator.queue';
import Redis from 'ioredis';
import { ElevatorArrivedEvent } from '../elevator-arrived.event';

@EventsHandler(ElevatorCalledEvent)
@Injectable()
export class ElevatorCalledHandler implements IEventHandler<ElevatorCalledEvent> {
  private readonly logger = new Logger(ElevatorCalledHandler.name);

  constructor(
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly kafkaProducer: KafkaProducerAdapter,
  ) {}

  async handle(event: ElevatorCalledEvent): Promise<void> {
    this.logger.log(`Elevator ${event.elevatorId} called from ${event.fromFloor} to ${event.toFloor}`);

    this.websocketAdapter.broadcast('elevator-called', {
      elevatorId: event.elevatorId,
      fromFloor: event.fromFloor,
      toFloor: event.toFloor,
      timestamp: event.timestamp,
    });

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
  ) {}

  async handle(event: ElevatorMovingEvent): Promise<void> {
    this.logger.log(`Elevator ${event.elevatorId} moving ${event.direction} to floor ${event.toFloor}`);

    await this.redis.hmset(`elevator:${event.elevatorId}:state`, {
      currentFloor: event.fromFloor,
      state: 'MOVING',
      direction: event.direction,
      targetFloor: event.toFloor,
      lastUpdated: event.timestamp.toISOString(),
    });

    await this.movementQueue.addMovementJob({
      elevatorId: event.elevatorId,
      fromFloor: event.fromFloor,
      toFloor: event.toFloor,
      direction: event.direction,
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId: event.elevatorId,
      currentFloor: event.fromFloor,
      state: 'MOVING',
      direction: event.direction,
      targetFloor: event.toFloor,
    });

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
  ) {}

  async handle(event: ElevatorArrivedEvent): Promise<void> {
    this.logger.log(`Elevator arrived at floor ${event.floor}`);

    await this.redis.hmset(`elevator:${event.elevatorId}:state`, {
      currentFloor: event.floor,
      state: 'DOORS_OPENING',
      lastUpdated: event.timestamp.toISOString(),
    });

    
    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId: event.elevatorId,
      currentFloor: event.floor,
      state: 'DOORS_OPENING',
    });

    await this.kafkaProducer.publish('elevator.arrived', event);
  }
}