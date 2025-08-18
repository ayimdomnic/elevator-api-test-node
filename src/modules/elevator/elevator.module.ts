import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { ElevatorEntity } from './infrastructure/persistence/entities/elevator.entity';
import { ElevatorEventEntity } from './infrastructure/persistence/entities/elevator-event.entity';

import { ElevatorController } from './interfaces/http/elevator.controller';
import { ElevatorGateway } from './interfaces/websocket/elevator.gateway';

import { CallElevatorHandler } from './application/commands/handlers/call-elevator.handler';
import { InitializeElevatorHandler } from './application/commands/handlers/intialize-elevator.handler';

import { GetElevatorStatusHandler } from './application/queries/handlers/get-elevator-status.handler';
import { GetAllElevatorsHandler } from './application/queries/handlers/get-all-elevators.handler';
import { GetElevatorLogsHandler } from './application/queries/handlers/get-elevator-logs.handler';

import {
  ElevatorCalledHandler,
  ElevatorMovingHandler,
  ElevatorArrivedHandler,
} from './application/events/handlers/event-handlers';

import { ElevatorRepository } from './infrastructure/repositories/elevator.repository';
import { ElevatorEventStore } from './infrastructure/persistence/event-store/elevator-event.store';
import { ElevatorAssignmentService } from './application/services/elevator-assignment.service';
import { WebSocketAdapter } from './infrastructure/adapters/websocket.adapter';
import { KafkaProducerAdapter } from './infrastructure/adapters/kafka-producer.adapter';
import { MovementProcessor } from './infrastructure/queues/processors/movement.processor';

import { getRedisConfig, getKafkaConfig } from '../../config';
import { KafkaProducer } from './infrastructure/adapters/kafka.provider';
import { ElevatorMovementQueue } from './infrastructure/adapters/elevator.queue';
import { LoggingModule, QueryLoggerService } from '../logging';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([ElevatorEntity, ElevatorEventEntity]),
    BullModule.registerQueue({
      name: 'elevator-movement',
    }),
    LoggingModule,
  ],
  controllers: [ElevatorController],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>{
        const config = getRedisConfig(configService);
        return new Redis(config);
      },
    },

    {
      provide: 'KAFKA_CLIENT',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const { Kafka } = await import('kafkajs');
        return new Kafka(getKafkaConfig(configService));
      },
    },
    {
      provide: 'KAFKA_PRODUCER',
      useFactory: async (kafkaProducer: KafkaProducer) => {
        await kafkaProducer.connect();
        return kafkaProducer.getProducer();
      },
      inject: [KafkaProducer],
    },
    ElevatorGateway,
    ElevatorRepository,
    ElevatorEventStore,
    ElevatorAssignmentService,
    WebSocketAdapter,
    KafkaProducerAdapter,
    ElevatorMovementQueue,
    MovementProcessor,
    CallElevatorHandler,
    InitializeElevatorHandler,
    GetElevatorStatusHandler,
    GetAllElevatorsHandler,
    GetElevatorLogsHandler,
    ElevatorCalledHandler,
    ElevatorMovingHandler,
    ElevatorArrivedHandler,
    KafkaProducerAdapter,
    KafkaProducer,
  ],
  exports: [ElevatorRepository, WebSocketAdapter],
})
export class ElevatorModule {}
