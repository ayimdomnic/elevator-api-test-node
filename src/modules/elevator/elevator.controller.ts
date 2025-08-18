import { Controller } from '@nestjs/common';
import { ElevatorService } from './elevator.service';

@Controller('elevator')
export class ElevatorController {
  constructor(private readonly elevatorService: ElevatorService) {}
}
