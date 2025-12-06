import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { SensorsGateway } from './sensors.gateway';

@Injectable()
export class SensorSimulatorService {
  private logger = new Logger('SensorSimulatorService');
  private isRunning = false;

  // State untuk setiap machine agar nilai berubah smooth
  private machineStates = new Map<
    string,
    {
      airTemp: number;
      processTemp: number;
      rotationalSpeed: number;
      torque: number;
      toolWear: number;
    }
  >();

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
          // Base values (target normal operation)
          const baseTemp = 298.0;
          const baseProcessTemp = 308.0;
          const baseSpeed = 1500;
          const baseTorque = 40;
          const baseToolWear = 50; // Start from low wear

          // Get or initialize machine state
          let state = this.machineStates.get(machine.id);

          if (!state) {
            // Initialize state dengan nilai awal yang normal
            state = {
              airTemp: baseTemp + (Math.random() - 0.5) * 2,
              processTemp: baseProcessTemp + (Math.random() - 0.5) * 3,
              rotationalSpeed:
                baseSpeed + Math.floor((Math.random() - 0.5) * 50),
              torque: baseTorque + (Math.random() - 0.5) * 3,
              toolWear: baseToolWear + Math.floor(Math.random() * 20),
            };
            this.machineStates.set(machine.id, state);
          }

          // Smooth transitions - perubahan kecil bertahap (max 1-2% per interval)
          // Air Temperature: berubah sangat smooth ±0.5°C
          const airTempChange = (Math.random() - 0.5) * 0.5;
          const airTemp = this.smoothValue(
            state.airTemp + airTempChange,
            baseTemp,
            2.0, // max deviation
          );

          // Process Temperature: sedikit lebih dinamis ±1°C
          const processTempChange = (Math.random() - 0.5) * 1.0;
          const processTemp = this.smoothValue(
            state.processTemp + processTempChange,
            baseProcessTemp,
            4.0, // max deviation
          );

          // Rotational Speed: berubah bertahap ±10 RPM
          const speedChange = Math.floor((Math.random() - 0.5) * 10);
          const rotationalSpeed = Math.floor(
            this.smoothValue(
              state.rotationalSpeed + speedChange,
              baseSpeed,
              30, // max deviation
            ),
          );

          // Torque: smooth changes ±0.3 Nm
          const torqueChange = (Math.random() - 0.5) * 0.3;
          const torque = this.smoothValue(
            state.torque + torqueChange,
            baseTorque,
            2.5, // max deviation
          );

          // Tool Wear: gradually increases (realistic wear over time)
          const toolWearIncrease = Math.random() * 0.1; // Very slow increase
          const toolWear = Math.min(
            200,
            Math.floor(state.toolWear + toolWearIncrease),
          );

          // Update state untuk next iteration
          state.airTemp = airTemp;
          state.processTemp = processTemp;
          state.rotationalSpeed = rotationalSpeed;
          state.torque = torque;
          state.toolWear = toolWear;
          this.machineStates.set(machine.id, state);

          const sensorData = await this.prisma.sensorData.create({
            data: {
              machineId: machine.id,
              productId: machine.productId,
              airTemp: parseFloat(airTemp.toFixed(2)),
              processTemp: parseFloat(processTemp.toFixed(2)),
              rotationalSpeed,
              torque: parseFloat(torque.toFixed(2)),
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

  /**
   * Helper function untuk smooth value changes
   * Membatasi nilai agar tidak jauh dari base value
   */
  private smoothValue(
    currentValue: number,
    baseValue: number,
    maxDeviation: number,
  ): number {
    // Jika nilai terlalu jauh dari base, tarik kembali ke base
    if (currentValue > baseValue + maxDeviation) {
      return baseValue + maxDeviation;
    }
    if (currentValue < baseValue - maxDeviation) {
      return baseValue - maxDeviation;
    }
    return currentValue;
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
    this.logger.log('🟢 Sensor simulator started');
  }

  stopSimulation() {
    this.isRunning = false;
    this.logger.log('🔴 Sensor simulator stopped');
  }

  /**
   * Reset state untuk machine tertentu (untuk testing)
   */
  resetMachineState(machineId: string) {
    this.machineStates.delete(machineId);
    this.logger.log(`Reset state for machine ${machineId}`);
  }

  /**
   * Clear all machine states
   */
  clearAllStates() {
    this.machineStates.clear();
    this.logger.log('Cleared all machine states');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      message: this.isRunning ? 'Simulator is running' : 'Simulator is stopped',
    };
  }
}
