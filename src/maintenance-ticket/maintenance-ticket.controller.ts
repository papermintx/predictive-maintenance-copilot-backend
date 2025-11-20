import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MaintenanceTicketService } from './maintenance-ticket.service';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';
import { UpdateMaintenanceTicketDto } from './dto/update-maintenance-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('maintenance-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceTicketController {
  constructor(
    private readonly maintenanceTicketService: MaintenanceTicketService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createMaintenanceTicketDto: CreateMaintenanceTicketDto,
    @Req() req,
  ) {
    return this.maintenanceTicketService.create(
      createMaintenanceTicketDto,
      req.user.id,
    );
  }

  @Get()
  findAll() {
    return this.maintenanceTicketService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.maintenanceTicketService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.technician)
  update(
    @Param('id') id: string,
    @Body() updateMaintenanceTicketDto: UpdateMaintenanceTicketDto,
  ) {
    return this.maintenanceTicketService.update(id, updateMaintenanceTicketDto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.maintenanceTicketService.cancel(id);
  }
}
