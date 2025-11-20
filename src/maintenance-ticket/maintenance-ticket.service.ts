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
    return this.prisma.maintenanceTicket.findMany();
  }

  async findOne(id: string) {
    return this.prisma.maintenanceTicket.findUnique({
      where: { id },
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
