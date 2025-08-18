import { Inject, Injectable } from '@nestjs/common';
import { Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerAdapter {
  private readonly producer: Producer;

  constructor(@Inject('KAFKA_PRODUCER') producer: Producer) {
    this.producer = producer;
  }

  async publish(topic: string, message: any) {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }
}
