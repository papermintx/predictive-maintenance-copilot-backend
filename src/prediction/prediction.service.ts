import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PredictionService {
  constructor(private prisma: PrismaService) {}

  async findAll(limit = 100, machineId?: string) {
    return this.prisma.predictionResult.findMany({
      where: machineId ? { machineId } : undefined,
      include: {
        machine: {
          select: {
            id: true,
            productId: true,
            name: true,
            type: true,
            status: true,
            location: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  async findOne(id: string) {
    return this.prisma.predictionResult.findUnique({
      where: { id },
      include: {
        machine: {
          select: {
            id: true,
            productId: true,
            name: true,
            type: true,
            status: true,
            location: true,
          },
        },
      },
    });
  }

  async findByMachine(machineId: string, limit = 50) {
    return this.prisma.predictionResult.findMany({
      where: { machineId },
      include: {
        machine: {
          select: {
            id: true,
            productId: true,
            name: true,
            type: true,
            status: true,
            location: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  async findHighRisk(threshold = 0.7, limit = 50) {
    return this.prisma.predictionResult.findMany({
      where: {
        riskScore: {
          gte: threshold,
        },
      },
      include: {
        machine: {
          select: {
            id: true,
            productId: true,
            name: true,
            type: true,
            status: true,
            location: true,
          },
        },
      },
      orderBy: [
        { riskScore: 'desc' },
        { timestamp: 'desc' },
      ],
      take: limit,
    });
  }

  async findFailurePredicted(limit = 50) {
    return this.prisma.predictionResult.findMany({
      where: {
        failurePredicted: true,
      },
      include: {
        machine: {
          select: {
            id: true,
            productId: true,
            name: true,
            type: true,
            status: true,
            location: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  async findAnomalies(limit = 50) {
    return this.prisma.predictionResult.findMany({
      where: {
        anomalyDetected: true,
      },
      include: {
        machine: {
          select: {
            id: true,
            productId: true,
            name: true,
            type: true,
            status: true,
            location: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  async getStatistics() {
    const [
      total,
      highRisk,
      failurePredicted,
      anomalies,
      avgRiskScore,
    ] = await Promise.all([
      this.prisma.predictionResult.count(),
      this.prisma.predictionResult.count({
        where: { riskScore: { gte: 0.7 } },
      }),
      this.prisma.predictionResult.count({
        where: { failurePredicted: true },
      }),
      this.prisma.predictionResult.count({
        where: { anomalyDetected: true },
      }),
      this.prisma.predictionResult.aggregate({
        _avg: { riskScore: true },
      }),
    ]);

    return {
      total,
      highRisk,
      failurePredicted,
      anomalies,
      averageRiskScore: avgRiskScore._avg.riskScore || 0,
    };
  }
}
