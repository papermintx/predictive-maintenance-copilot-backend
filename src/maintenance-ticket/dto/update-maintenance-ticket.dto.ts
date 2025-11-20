import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MaintenanceStatus } from '@prisma/client';

export const updateMaintenanceTicketSchema = z.object({
  status: z.enum(MaintenanceStatus).optional(),
});

export class UpdateMaintenanceTicketDto extends createZodDto(
  updateMaintenanceTicketSchema,
) {}
