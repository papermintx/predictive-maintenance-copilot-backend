import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.userService.findAll();
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') id: string,
    @Body() updateData: { fullName?: string; email?: string; role?: string },
  ) {
    // Validate role if provided
    if (updateData.role) {
      const validRoles = ['admin', 'operator', 'technician', 'viewer'];
      if (!validRoles.includes(updateData.role)) {
        throw new Error('Invalid role');
      }
    }
    return this.userService.updateUser(id, {
      ...updateData,
      role: updateData.role as UserRole | undefined,
    });
  }

  @Patch(':id/role')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.userService.updateUser(id, {
      role: updateUserRoleDto.role as UserRole,
    });
  }

  @Patch(':id/activate')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    return this.userService.activateUser(id);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    return this.userService.deactivateUser(id);
  }
}
