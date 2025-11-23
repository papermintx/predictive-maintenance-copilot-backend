import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { SensorSimulatorService } from './sensor-simulator.service';
import {
  CreateSensorReadingDto,
  QuerySensorReadingsDto,
  BatchCreateSensorReadingsDto,
} from './dto/sensor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('sensors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SensorsController {
  constructor(
    private readonly sensorsService: SensorsService,
    private readonly sensorSimulatorService: SensorSimulatorService,
  ) {}

  @Post()
  @Roles(UserRole.admin, UserRole.operator)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createSensorReadingDto: CreateSensorReadingDto) {
    return this.sensorsService.create(createSensorReadingDto);
  }

  @Post('batch')
  @Roles(UserRole.admin, UserRole.operator)
  @HttpCode(HttpStatus.CREATED)
  createBatch(@Body() batchCreateDto: BatchCreateSensorReadingsDto) {
    return this.sensorsService.createBatch(batchCreateDto);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.operator, UserRole.viewer)
  findAll(@Query() query: QuerySensorReadingsDto) {
    return this.sensorsService.findAll(query);
  }

  @Get('statistics/:machineId')
  @Roles(UserRole.admin, UserRole.operator, UserRole.viewer)
  getStatistics(@Param('machineId') machineId: string) {
    return this.sensorsService.getStatistics(machineId);
  }

  @Get(':udi')
  @Roles(UserRole.admin, UserRole.operator, UserRole.viewer)
  findOne(@Param('udi', ParseIntPipe) udi: number) {
    return this.sensorsService.findOne(udi);
  }

  @Delete(':udi')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  remove(@Param('udi', ParseIntPipe) udi: number) {
    return this.sensorsService.remove(udi);
  }

  // Simulator endpoints
  @Post('simulator/start')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  startSimulator() {
    this.sensorSimulatorService.startSimulation();
    return {
      message: 'Sensor simulator started',
      status: 'running',
    };
  }

  @Post('simulator/stop')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  stopSimulator() {
    this.sensorSimulatorService.stopSimulation();
    return {
      message: 'Sensor simulator stopped',
      status: 'stopped',
    };
  }

  @Get('simulator/status')
  @Roles(UserRole.admin, UserRole.operator)
  getSimulatorStatus() {
    return this.sensorSimulatorService.getStatus();
  }

  @Post('simulator/anomaly/:machineId')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.CREATED)
  generateAnomaly(@Param('machineId') machineId: string) {
    return this.sensorSimulatorService.generateAnomalySensorData(machineId);
  }
}
