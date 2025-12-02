import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('predictions')
@UseGuards(JwtAuthGuard)
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('limit') limit?: string,
    @Query('machineId') machineId?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.predictionService.findAll(limitNum, machineId);
  }

  @Get('statistics')
  @HttpCode(HttpStatus.OK)
  async getStatistics() {
    return this.predictionService.getStatistics();
  }

  @Get('high-risk')
  @HttpCode(HttpStatus.OK)
  async findHighRisk(
    @Query('threshold') threshold?: string,
    @Query('limit') limit?: string,
  ) {
    const thresholdNum = threshold ? parseFloat(threshold) : 0.7;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.predictionService.findHighRisk(thresholdNum, limitNum);
  }

  @Get('failures')
  @HttpCode(HttpStatus.OK)
  async findFailurePredicted(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.predictionService.findFailurePredicted(limitNum);
  }

  @Get('anomalies')
  @HttpCode(HttpStatus.OK)
  async findAnomalies(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.predictionService.findAnomalies(limitNum);
  }

  @Get('machine/:machineId')
  @HttpCode(HttpStatus.OK)
  async findByMachine(
    @Param('machineId') machineId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.predictionService.findByMachine(machineId, limitNum);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.predictionService.findOne(id);
  }
}
