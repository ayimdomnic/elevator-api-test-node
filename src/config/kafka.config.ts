import { ConfigService } from '@nestjs/config';

export const getKafkaConfig = (configService: ConfigService) => ({
  clientId: 'elevator-service',
  brokers: configService.get('KAFKA_BROKERS', 'localhost:9092').split(','),
  ssl: configService.get('KAFKA_SSL') === 'true',
  sasl: configService.get('KAFKA_USERNAME')
    ? {
        mechanism: 'plain',
        username: configService.get('KAFKA_USERNAME'),
        password: configService.get('KAFKA_PASSWORD'),
      }
    : undefined,
});
