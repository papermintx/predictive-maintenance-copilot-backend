import { Module } from '@nestjs/common';
import { MaintenanceTicketController } from './maintenance-ticket.controller';
import { MaintenanceTicketService } from './maintenance-ticket.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceTicketController],
  providers: [MaintenanceTicketService],
})
export class MaintenanceTicketModule {}
