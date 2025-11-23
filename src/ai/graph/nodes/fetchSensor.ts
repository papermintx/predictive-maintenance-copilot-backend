/**
 * Fetch Sensor Data Node
 * Retrieves recent sensor readings for the identified machine
 */

import { Logger } from '@nestjs/common';
import { NestApiClient } from '../../tools/nestApiClient';
import type { MaintenanceGraphState, SensorDataPoint } from '../state';

export class FetchSensorNode {
  private readonly logger = new Logger(FetchSensorNode.name);

  constructor(private apiClient: NestApiClient) {}

  async execute(
    state: MaintenanceGraphState,
  ): Promise<Partial<MaintenanceGraphState>> {
    try {
      if (!state.machine_id) {
        this.logger.warn(
          '[FetchSensor] No machine_id in state, skipping sensor fetch',
        );
        return {
          sensor_data: undefined,
          should_continue: true,
        };
      }

      this.logger.log(
        `[FetchSensor] Fetching sensor data for machine: ${state.machine_id}`,
      );

      const sensorReadings = await this.apiClient.getSensorData(
        state.machine_id,
        10,
      );

      if (sensorReadings.length === 0) {
        this.logger.warn(
          `[FetchSensor] ⚠️  No sensor data found for machine: ${state.machine_id}`,
        );
        return {
          sensor_data: [],
          should_continue: true,
        };
      }

      const sensorData: SensorDataPoint[] = sensorReadings.map((reading) => ({
        airTemp: reading.airTemp,
        processTemp: reading.processTemp,
        rotationalSpeed: reading.rotationalSpeed,
        torque: reading.torque,
        toolWear: reading.toolWear,
        timestamp: reading.timestamp,
      }));

      this.logger.log(
        `[FetchSensor] ✅ Fetched ${sensorData.length} sensor readings for machine ${state.machine_id}`,
      );

      return {
        sensor_data: sensorData,
        should_continue: true,
      };
    } catch (error) {
      this.logger.error('Error fetching sensor data:', error);
      return {
        error: 'Failed to fetch sensor data',
        sensor_data: [],
        should_continue: true,
      };
    }
  }
}
