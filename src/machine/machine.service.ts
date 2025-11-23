import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateMachineDto,
  UpdateMachineDto,
  QueryMachinesDto,
} from './dto/machine.dto';
import { Machine, Prisma } from '@prisma/client';

@Injectable()
export class MachineService {
  constructor(private prisma: PrismaService) {}

  async create(createMachineDto: CreateMachineDto): Promise<Machine> {
    // Check if productId already exists
    const existing = await this.prisma.machine.findUnique({
      where: { productId: createMachineDto.productId },
    });

    if (existing) {
      throw new ConflictException(
        'Machine with this product ID already exists',
      );
    }

    return this.prisma.machine.create({
      data: {
        ...createMachineDto,
        installationDate: createMachineDto.installationDate
          ? new Date(createMachineDto.installationDate)
          : undefined,
        lastMaintenanceDate: createMachineDto.lastMaintenanceDate
          ? new Date(createMachineDto.lastMaintenanceDate)
          : undefined,
      },
    });
  }

  async findAll(query: QueryMachinesDto) {
    const {
      search,
      type,
      status,
      location,
      includeStats,
      limit = 50,
      offset = 0,
    } = query;

    const where: Prisma.MachineWhereInput = {};

    // Search filter (productId or name)
    if (search) {
      where.OR = [
        { productId: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Type filter
    if (type) {
      where.type = type;
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Location filter (exact match)
    if (location) {
      where.location = location;
    }

    // Get total count
    const total = await this.prisma.machine.count({ where });

    // Get machines
    const machines = await this.prisma.machine.findMany({
      where,
      take: limit,
      skip: offset,
      include: includeStats
        ? {
            _count: {
              select: {
                sensorReadings: true,
                predictions: true,
              },
            },
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: machines,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async findOne(id: string): Promise<Machine> {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sensorReadings: true,
            predictions: true,
          },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    return machine;
  }

  async update(
    id: string,
    updateMachineDto: UpdateMachineDto,
  ): Promise<Machine> {
    // Check if machine exists
    await this.findOne(id);

    // If updating productId, check for conflicts
    if (updateMachineDto.productId) {
      const existing = await this.prisma.machine.findUnique({
        where: { productId: updateMachineDto.productId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Machine with this product ID already exists',
        );
      }
    }

    return this.prisma.machine.update({
      where: { id },
      data: {
        ...updateMachineDto,
        installationDate: updateMachineDto.installationDate
          ? new Date(updateMachineDto.installationDate)
          : undefined,
        lastMaintenanceDate: updateMachineDto.lastMaintenanceDate
          ? new Date(updateMachineDto.lastMaintenanceDate)
          : undefined,
      },
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    // Check if machine exists
    await this.findOne(id);

    await this.prisma.machine.delete({
      where: { id },
    });

    return { message: 'Machine deleted successfully' };
  }

  async getStats(id: string) {
    const machine = await this.findOne(id);

    const [
      sensorReadingsCount,
      predictionsCount,
      latestPrediction,
      criticalPredictions,
    ] = await Promise.all([
      this.prisma.sensorData.count({ where: { machineId: id } }),
      this.prisma.predictionResult.count({ where: { machineId: id } }),
      this.prisma.predictionResult.findFirst({
        where: { machineId: id },
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.predictionResult.count({
        where: {
          machineId: id,
          failurePredicted: true,
          riskScore: { gte: 0.7 },
        },
      }),
    ]);

    return {
      machine,
      stats: {
        totalSensorReadings: sensorReadingsCount,
        totalPredictions: predictionsCount,
        criticalPredictions,
        latestPrediction,
      },
    };
  }
}
