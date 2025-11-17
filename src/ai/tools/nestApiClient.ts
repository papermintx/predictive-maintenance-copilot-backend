/**
 * NestJS API Client
 * Calls internal NestJS backend endpoints for machine, sensor, and prediction data
 */

import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export class NestApiClient {
  private readonly logger = new Logger(NestApiClient.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get machine by product ID or UUID
   */
  async getMachine(machineId: string) {
    try {
      this.logger.log(`[getMachine] Looking up machine: ${machineId}`);

      // Check if machineId is a valid UUID format
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          machineId,
        );

      // Try UUID lookup only if it's a valid UUID
      if (isUUID) {
        const machine = await this.prisma.machine.findFirst({
          where: { id: machineId },
        });
        if (machine) {
          this.logger.log(`[getMachine] Found by UUID: ${machine.productId}`);
          return machine;
        }
      }

      // Try case-insensitive productId lookup
      const machine = await this.prisma.machine.findFirst({
        where: {
          productId: {
            equals: machineId,
            mode: 'insensitive',
          },
        },
      });
      if (machine) {
        this.logger.log(
          `[getMachine] Found by productId: ${machine.productId}`,
        );
        return machine;
      }
      this.logger.warn(`[getMachine] No machine found for: ${machineId}`);
      return null;
    } catch (error) {
      this.logger.error(
        `[getMachine] Error fetching machine ${machineId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get recent sensor readings for a machine
   */
  async getSensorData(machineId: string, limit: number = 10) {
    try {
      const readings = await this.prisma.sensorData.findMany({
        where: { machineId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
      return readings.reverse();
    } catch (error) {
      this.logger.error(`Error fetching sensor data for ${machineId}:`, error);
      return [];
    }
  }

  /**
   * Get latest prediction for a machine from database
   * ⭐ Used by chatbot real-time queries (NOT calling ML API)
   * Data is pre-computed by background ML batch job
   */
  async getLatestPredictionFromDB(machineId: string) {
    try {
      const prediction = await this.prisma.predictionResult.findFirst({
        where: { machineId },
        orderBy: { timestamp: 'desc' },
      });
      return prediction;
    } catch (error) {
      this.logger.error(
        `Error fetching prediction from DB for ${machineId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get latest prediction for a machine (alias for getLatestPredictionFromDB)
   */
  async getLatestPrediction(machineId: string) {
    return this.getLatestPredictionFromDB(machineId);
  }

  /**
   * Get machine with all related data
   */
  async getMachineContext(machineId: string) {
    try {
      const machine = await this.getMachine(machineId);
      if (!machine) return null;

      const [sensors, prediction] = await Promise.all([
        this.getSensorData(machine.id, 10),
        this.getLatestPrediction(machine.id),
      ]);

      return {
        machine,
        sensors,
        prediction,
      };
    } catch (error) {
      this.logger.error(`Error getting machine context:`, error);
      return null;
    }
  }

  /**
   * Search machines by multiple criteria
   */
  async searchMachines(criteria: {
    productId?: string;
    name?: string;
    type?: string;
    location?: string;
  }) {
    try {
      this.logger.log(`[searchMachines] Criteria: ${JSON.stringify(criteria)}`);
      const whereConditions: any = {};

      if (criteria.productId) {
        // Use exact match (case-insensitive) for productId, not partial match
        whereConditions.productId = {
          equals: criteria.productId,
          mode: 'insensitive',
        };
      }

      if (criteria.name) {
        whereConditions.name = {
          contains: criteria.name,
          mode: 'insensitive',
        };
      }

      if (criteria.type) {
        whereConditions.type = criteria.type.toUpperCase();
      }

      if (criteria.location) {
        whereConditions.location = {
          contains: criteria.location,
          mode: 'insensitive',
        };
      }

      const machines = await this.prisma.machine.findMany({
        where: whereConditions,
        orderBy: { productId: 'asc' },
      });
      this.logger.log(`[searchMachines] Found ${machines.length} machines`);
      return machines;
    } catch (error) {
      this.logger.error('[searchMachines] Error:', error);
      return [];
    }
  }

  /**
   * Get all machines summary
   */
  async getAllMachines() {
    try {
      const machines = await this.prisma.machine.findMany({
        include: {
          _count: {
            select: {
              sensorReadings: true,
              predictions: true,
            },
          },
        },
        orderBy: { productId: 'asc' },
      });
      return machines;
    } catch (error) {
      this.logger.error('Error fetching all machines:', error);
      return [];
    }
  }

  /**
   * Get machines by risk level (with optional time window and threshold filter)
   */
  async getMachinesByRisk(timeWindow?: string, riskThreshold?: string) {
    try {
      const machines = await this.prisma.machine.findMany({
        include: {
          predictions: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      // Filter and calculate risk scores
      const machinesWithRisk = machines
        .map((machine) => {
          const latestPrediction = machine.predictions[0];
          const riskScore = latestPrediction?.riskScore || 0;
          const riskLevel =
            riskScore >= 0.7 ? 'HIGH' : riskScore >= 0.4 ? 'MODERATE' : 'LOW';

          return {
            id: machine.id,
            productId: machine.productId,
            name: machine.name,
            type: machine.type,
            location: machine.location,
            riskScore,
            riskLevel,
            lastPredictionTime: latestPrediction?.timestamp,
            criticalAlerts: latestPrediction?.failurePredicted
              ? [
                  `Potensi kegagalan terdeteksi: ${latestPrediction.failureType}`,
                ]
              : [],
          };
        })
        .filter((m) => {
          // Apply risk threshold filter if specified
          if (riskThreshold === 'high') return m.riskLevel === 'HIGH';
          if (riskThreshold === 'moderate')
            return m.riskLevel === 'MODERATE' || m.riskLevel === 'HIGH';
          return true;
        });

      return machinesWithRisk;
    } catch (error) {
      this.logger.error('Error fetching machines by risk:', error);
      return [];
    }
  }

  /**
   * Get machines with failure predictions within time window
   */
  async getMachinesByPrediction(timeWindow?: string) {
    try {
      const now = new Date();
      const cutoffDate = new Date();

      // Calculate cutoff date based on time window
      if (timeWindow === '1_day') {
        cutoffDate.setDate(cutoffDate.getDate() - 1);
      } else if (timeWindow === '3_days') {
        cutoffDate.setDate(cutoffDate.getDate() - 3);
      } else if (timeWindow === '1_week') {
        cutoffDate.setDate(cutoffDate.getDate() - 7);
      } else if (timeWindow === '1_month') {
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      }

      const machines = await this.prisma.machine.findMany({
        include: {
          predictions: {
            where: {
              failurePredicted: true,
              timestamp: {
                gte: cutoffDate,
                lte: now,
              },
            },
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      const machinesWithPredictions = machines
        .filter((m) => m.predictions.length > 0)
        .map((machine) => {
          const prediction = machine.predictions[0];
          return {
            id: machine.id,
            productId: machine.productId,
            name: machine.name,
            type: machine.type,
            location: machine.location,
            riskScore: prediction?.riskScore || 0,
            riskLevel: 'HIGH',
            predictedFailureType: prediction?.failureType,
            predictedFailureTime: prediction?.predictedFailureTime,
            criticalAlerts: [
              `Prediksi kegagalan dalam ${timeWindow}: ${prediction?.failureType}`,
            ],
          };
        });

      return machinesWithPredictions;
    } catch (error) {
      this.logger.error('Error fetching machines by prediction:', error);
      return [];
    }
  }

  /**
   * Get machines with detected anomalies
   */
  async getMachinesByAnomaly() {
    try {
      const machines = await this.prisma.machine.findMany({
        include: {
          sensorReadings: {
            orderBy: { timestamp: 'desc' },
            take: 5,
          },
          predictions: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      const machinesWithAnomalies = machines
        .filter((machine) => {
          // Check if any recent prediction indicates anomaly
          const latestPrediction = machine.predictions[0];
          return latestPrediction && latestPrediction.riskScore > 0.5;
        })
        .map((machine) => {
          const prediction = machine.predictions[0];
          const anomalies = this.detectAnomalies(machine.sensorReadings);

          return {
            id: machine.id,
            productId: machine.productId,
            name: machine.name,
            type: machine.type,
            location: machine.location,
            riskScore: prediction?.riskScore || 0,
            riskLevel:
              prediction?.riskScore > 0.7
                ? 'HIGH'
                : prediction?.riskScore > 0.4
                  ? 'MODERATE'
                  : 'LOW',
            anomalies: anomalies,
            criticalAlerts: anomalies.slice(0, 2),
          };
        });

      return machinesWithAnomalies;
    } catch (error) {
      this.logger.error('Error fetching machines by anomaly:', error);
      return [];
    }
  }

  /**
   * Get machines at risk of overheating within time window
   */
  async getMachinesByOverheating(timeWindow?: string) {
    try {
      const now = new Date();
      const cutoffDate = new Date();

      if (timeWindow === '1_day') {
        cutoffDate.setDate(cutoffDate.getDate() - 1);
      } else if (timeWindow === '3_days') {
        cutoffDate.setDate(cutoffDate.getDate() - 3);
      }

      const machines = await this.prisma.machine.findMany({
        include: {
          sensorReadings: {
            where: {
              timestamp: {
                gte: cutoffDate,
                lte: now,
              },
            },
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
          predictions: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      const machinesAtRisk = machines
        .map((machine) => {
          const avgTemp =
            machine.sensorReadings.reduce((sum, reading) => {
              return sum + (reading.processTemp || 0);
            }, 0) / (machine.sensorReadings.length || 1);

          const isOverheating = avgTemp > 80; // Temperature threshold
          const prediction = machine.predictions[0];

          return {
            id: machine.id,
            productId: machine.productId,
            name: machine.name,
            type: machine.type,
            location: machine.location,
            riskScore: isOverheating ? 0.8 : prediction?.riskScore || 0,
            riskLevel: isOverheating ? 'HIGH' : 'MODERATE',
            currentTemp: machine.sensorReadings[0]?.processTemp || 0,
            avgTemp: parseFloat(avgTemp.toFixed(2)),
            criticalAlerts: isOverheating
              ? [
                  `Suhu proses tinggi: ${parseFloat(avgTemp.toFixed(2))}°C - Berisiko overheating`,
                ]
              : [],
          };
        })
        .filter((m) => m.riskScore > 0.5);

      return machinesAtRisk;
    } catch (error) {
      this.logger.error('Error fetching machines by overheating:', error);
      return [];
    }
  }

  /**
   * Get all machines with their current status
   */
  async getAllMachinesStatus() {
    try {
      const machines = await this.prisma.machine.findMany({
        include: {
          sensorReadings: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
          predictions: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
        orderBy: { productId: 'asc' },
      });

      return machines.map((machine) => {
        const latestPrediction = machine.predictions[0];
        const latestSensor = machine.sensorReadings[0];
        const riskScore = latestPrediction?.riskScore || 0;

        return {
          id: machine.id,
          productId: machine.productId,
          name: machine.name,
          type: machine.type,
          location: machine.location,
          riskScore,
          riskLevel:
            riskScore >= 0.7 ? 'HIGH' : riskScore >= 0.4 ? 'MODERATE' : 'LOW',
          currentTemp: latestSensor?.processTemp || 0,
          status: machine.status,
          lastUpdate: latestSensor?.timestamp || machine.createdAt,
          criticalAlerts: latestPrediction?.failurePredicted
            ? [`Prediksi kegagalan: ${latestPrediction.failureType}`]
            : [],
        };
      });
    } catch (error) {
      this.logger.error('Error fetching all machines status:', error);
      return [];
    }
  }

  /**
   * Detect anomalies in sensor readings
   */
  private detectAnomalies(readings: any[]): string[] {
    const anomalies: string[] = [];

    if (!readings || readings.length === 0) return anomalies;

    // Check for temperature anomalies
    const temps = readings.map((r) => r.processTemp || 0);
    const maxTemp = Math.max(...temps);

    if (maxTemp > 90) {
      anomalies.push('Suhu proses abnormal tinggi terdeteksi');
    }

    // Check for rotational speed anomalies
    const speeds = readings.map((r) => r.rotationalSpeed || 0);
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const speedVariance =
      speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) /
      speeds.length;

    if (speedVariance > 10000) {
      anomalies.push('Kecepatan rotasi tidak stabil');
    }

    // Check for torque anomalies
    const torques = readings.map((r) => r.torque || 0);
    const maxTorque = Math.max(...torques);

    if (maxTorque > 80) {
      anomalies.push('Torque abnormal tinggi');
    }

    return anomalies;
  }
}
