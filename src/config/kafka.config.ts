import { Kafka, Partitioners } from 'kafkajs';

export const kafka = new Kafka({
  clientId: 'elevator-service',
  brokers: [process.env.KAFKA_BROKER_URL],
});

export const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
});

export const consumer = kafka.consumer({
  groupId: 'elevator-group',
});
