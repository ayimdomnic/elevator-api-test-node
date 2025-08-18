// src/modules/elevator/interfaces/http/elevator.controller.ts
import { Controller, Post, Get, Body, Param, Query, UseInterceptors } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CallElevatorDto, ElevatorStatusDto, ElevatorLogsDto } from './dtos';
import { CallElevatorCommand, InitializeElevatorCommand } from '../../application/commands';
import { GetElevatorStatusQuery, GetAllElevatorsQuery, GetElevatorLogsQuery } from '../../application/queries';
import { QueryTrackingInterceptor } from '../../../../shared/interceptors/query-tracking.interceptor';

@ApiTags('elevators')
@Controller('api/elevators')
@UseInterceptors(QueryTrackingInterceptor)
export class ElevatorController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('call')
  @ApiOperation({ summary: 'Call an elevator from any floor to any other floor' })
  @ApiResponse({ status: 200, description: 'Elevator called successfully' })
  async callElevator(@Body() dto: CallElevatorDto) {
    const result = await this.commandBus.execute(
      new CallElevatorCommand(dto.fromFloor, dto.toFloor, dto.userId)
    );
    return {
      success: true,
      elevatorId: result.elevatorId,
      message: `Elevator ${result.elevatorId} called from floor ${dto.fromFloor} to ${dto.toFloor}`,
    };
  }

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize a new elevator' })
  @ApiResponse({ status: 201, description: 'Elevator initialized successfully' })
  async initializeElevator(@Body() dto: { initialFloor?: number }) {
    const result = await this.commandBus.execute(
      new InitializeElevatorCommand(dto.initialFloor)
    );
    return {
      success: true,
      elevatorId: result.elevatorId,
      message: `Elevator ${result.elevatorId} initialized at floor ${dto.initialFloor || 0}`,
    };
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get real-time elevator status' })
  @ApiResponse({ status: 200, type: ElevatorStatusDto })
  async getElevatorStatus(@Param('id') elevatorId: string) {
    return this.queryBus.execute(new GetElevatorStatusQuery(elevatorId));
  }

  @Get()
  @ApiOperation({ summary: 'Get all elevators status' })
  @ApiResponse({ status: 200, type: [ElevatorStatusDto] })
  async getAllElevators() {
    return this.queryBus.execute(new GetAllElevatorsQuery());
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get elevator event logs' })
  @ApiResponse({ status: 200, type: [ElevatorLogsDto] })
  async getElevatorLogs(
    @Param('id') elevatorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute(
      new GetElevatorLogsQuery(
        elevatorId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      )
    );
  }
}