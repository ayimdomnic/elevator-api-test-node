import { Test, TestingModule } from '@nestjs/testing';
import { ElevatorController } from './elevator.controller';
import { ElevatorService } from './elevator.service';

describe('ElevatorController', () => {
  let controller: ElevatorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElevatorController],
      providers: [ElevatorService],
    }).compile();

    controller = module.get<ElevatorController>(ElevatorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
