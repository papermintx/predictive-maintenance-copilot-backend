import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer', 'technician']),
});

export class UpdateUserRoleDto extends createZodDto(updateUserRoleSchema) {}
