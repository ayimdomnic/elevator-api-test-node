import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Elevator API')
  .setDescription('Elevator API description')
  .setVersion('1.0')
  .addTag('elevator')
  .addBearerAuth()
  .build();
