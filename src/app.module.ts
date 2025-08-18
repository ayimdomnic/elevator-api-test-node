import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElevatorModule } from './modules/elevator/elevator.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [ElevatorModule, WebsocketModule, HealthModule, AuditModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
