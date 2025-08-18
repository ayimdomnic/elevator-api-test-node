import { Module } from '@nestjs/common';
import { ElevatorService } from './elevator.service';
import { ElevatorController } from './elevator.controller';

@Module({
  controllers: [ElevatorController],
  providers: [ElevatorService],
})
export class ElevatorModule {}
