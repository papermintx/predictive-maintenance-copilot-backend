import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createMaintenanceTicketSchema = z.object({
  machineId: z.string().uuid('Invalid machine ID format'),
  description: z.string().min(1, 'Description is required'),
});

export class CreateMaintenanceTicketDto extends createZodDto(
  createMaintenanceTicketSchema,
) {}
