import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { SensorsGateway } from './sensors.gateway';

@Injectable()
export class SensorSimulatorService {
  private logger = new Logger('SensorSimulatorService');
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => SensorsGateway))
    private sensorsGateway: SensorsGateway,
  ) {}

  // Generate sensor data setiap 5 detik
  @Cron(CronExpression.EVERY_5_SECONDS)
  async generateSensorData() {
    if (!this.isRunning) return;

    try {
      // Get all active machines
      const machines = await this.prisma.machine.findMany({
        where: { status: 'operational' },
        take: 10, // Limit untuk performa
      });

      if (machines.length === 0) {
        return;
      }

      // Generate data untuk setiap machine satu per satu
      let successCount = 0;

      for (const machine of machines) {
        try {
          // Generate realistic sensor values dengan variasi
          const baseTemp = 298.0;
          const baseProcessTemp = 308.0;
          const baseSpeed = 1500;
          const baseTorque = 40;

          // Tambahkan random noise untuk simulasi real-world
          const airTemp = baseTemp + (Math.random() - 0.5) * 5;
          const processTemp = baseProcessTemp + (Math.random() - 0.5) * 10;
          const rotationalSpeed = Math.floor(
            baseSpeed + (Math.random() - 0.5) * 200,
          );
          const torque = baseTorque + (Math.random() - 0.5) * 15;
          const toolWear = Math.floor(Math.random() * 200);

          const sensorData = await this.prisma.sensorData.create({
            data: {
              machineId: machine.id,
              productId: machine.productId,
              airTemp,
              processTemp,
              rotationalSpeed,
              torque,
              toolWear,
              timestamp: new Date(),
            },
          });

          // Broadcast via WebSocket immediately
          this.sensorsGateway.broadcastSensorUpdate({
            udi: sensorData.udi,
            machine_id: sensorData.machineId,
            product_id: sensorData.productId,
            air_temp: sensorData.airTemp,
            process_temp: sensorData.processTemp,
            rotational_speed: sensorData.rotationalSpeed,
            torque: sensorData.torque,
            tool_wear: sensorData.toolWear,
            timestamp: sensorData.timestamp,
          });

          successCount++;
        } catch (err) {
          this.logger.error(
            `Failed to generate data for machine ${machine.productId}:`,
            err.message,
          );
        }
      }

      this.logger.debug(`Generated ${successCount} sensor readings`);
    } catch (error) {
      this.logger.error('Failed to generate sensor data:', error);
    }
  }

  // Generate anomaly sensor data (untuk testing alert)
  async generateAnomalySensorData(machineId: string) {
    try {
      const machine = await this.prisma.machine.findUnique({
        where: { id: machineId },
      });

      if (!machine) {
        throw new Error('Machine not found');
      }

      // Generate anomaly: high temperature, unusual speed
      const anomalyData = {
        machineId: machine.id,
        productId: machine.productId,
        airTemp: 310.0 + Math.random() * 20, // Overheat
        processTemp: 330.0 + Math.random() * 30, // Critical
        rotationalSpeed: Math.floor(2000 + Math.random() * 500), // Too fast
        torque: 70 + Math.random() * 20, // High torque
        toolWear: Math.floor(180 + Math.random() * 20), // Worn out
        timestamp: new Date(),
      };

      const result = await this.prisma.sensorData.create({
        data: anomalyData,
      });

      // Broadcast anomaly data via WebSocket
      this.sensorsGateway.broadcastSensorUpdate({
        udi: result.udi,
        machine_id: result.machineId,
        product_id: result.productId,
        air_temp: result.airTemp,
        process_temp: result.processTemp,
        rotational_speed: result.rotationalSpeed,
        torque: result.torque,
        tool_wear: result.toolWear,
        timestamp: result.timestamp,
      });

      this.logger.log(`Generated anomaly data for machine ${machineId}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to generate anomaly data:', error);
      throw error;
    }
  }

  startSimulation() {
    this.isRunning = true;
  }

  stopSimulation() {
    this.isRunning = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      message: this.isRunning
        ? 'Simulator is running'
        : 'Simulator is stopped',
    };
  }
}
