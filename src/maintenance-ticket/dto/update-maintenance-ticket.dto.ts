import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateMaintenanceTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'closed', 'canceled']).optional(),
});

export class UpdateMaintenanceTicketDto extends createZodDto(
  updateMaintenanceTicketSchema,
) {}
