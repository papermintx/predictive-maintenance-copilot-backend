import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';
import { UpdateMaintenanceTicketDto } from './dto/update-maintenance-ticket.dto';

@Injectable()
export class MaintenanceTicketService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createMaintenanceTicketDto: CreateMaintenanceTicketDto,
    userId: string,
  ) {
    return this.prisma.maintenanceTicket.create({
      data: {
        ...createMaintenanceTicketDto,
        requestedById: userId,
      },
    });
  }

  async findAll() {
    return this.prisma.maintenanceTicket.findMany({
      include: {
        machine: {
          select: {
            id: true,
            productId: true,
            name: true,
            location: true,
            status: true,
            type: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: {
        machine: {
          select: {
            id: true,
            productId: true,
            name: true,
            location: true,
            status: true,
            type: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    updateMaintenanceTicketDto: UpdateMaintenanceTicketDto,
  ) {
    return this.prisma.maintenanceTicket.update({
      where: { id },
      data: updateMaintenanceTicketDto,
    });
  }

  async cancel(id: string) {
    return this.prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status: 'canceled',
      },
    });
  }
}
