// src/config/kafka.config.ts
import { ConfigService } from '@nestjs/config';
import { SASLOptions } from 'kafkajs';

export const getKafkaConfig = (configService: ConfigService) => {
  const sasl: SASLOptions | undefined = configService.get('KAFKA_USERNAME')
    ? {
        mechanism: 'plain',
        username: configService.get('KAFKA_USERNAME'),
        password: configService.get('KAFKA_PASSWORD'),
      }
    : undefined;

  return {
    clientId: 'elevator-service',
    brokers: configService.get('KAFKA_BROKERS', 'localhost:9092').split(','),
    ssl: configService.get('KAFKA_SSL') === 'true',
    sasl,
  };
};