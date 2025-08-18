import { Test, TestingModule } from '@nestjs/testing';
import { ElevatorService } from './elevator.service';

describe('ElevatorService', () => {
  let service: ElevatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ElevatorService],
    }).compile();

    service = module.get<ElevatorService>(ElevatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
