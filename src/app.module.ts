import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElevatorModule } from './modules/elevator/elevator.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [
    ElevatorModule,
    WebsocketModule,
    HealthModule,
    AuditModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
