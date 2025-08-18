import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bull';
import { ElevatorModule } from './modules/elevator/elevator.module';
import { LoggingModule } from './modules/logging/logging.module';
import { getDatabaseConfig } from './config/database.config';
import { getRedisConfig } from './config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: getRedisConfig(configService),
      }),
    }),
    CqrsModule,
    ElevatorModule,
    LoggingModule,
  ],
})
export class AppModule {}
