import { Module } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { SensorsController } from './sensors.controller';
import { SensorsGateway } from './sensors.gateway';
import { SupabaseRealtimeService } from './supabase-realtime.service';
import { SensorSimulatorService } from './sensor-simulator.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SensorsController],
  providers: [
    SensorsService,
    SensorsGateway,
    SupabaseRealtimeService,
    SensorSimulatorService,
  ],
  exports: [SensorsService, SupabaseRealtimeService, SensorSimulatorService],
})
export class SensorsModule {}
