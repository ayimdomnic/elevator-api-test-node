import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducer implements OnModuleDestroy {
  private producer: Producer;

  constructor(@Inject('KAFKA_CLIENT') private readonly kafka: Kafka) {
    this.producer = this.kafka.producer();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async connect() {
    await this.producer.connect();
  }

  getProducer(): Producer {
    return this.producer;
  }
}