import { Controller, Post, Body, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { GetCurrentUserId, Roles } from '../common/decorators';
import { Role } from '@prisma/client';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('users/:id/ban')
  banUser(
    @Param('id') id: string,
    @GetCurrentUserId() adminId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.banUser(adminId, id, reason);
  }

  @Post('users/:id/unban')
  unbanUser(@Param('id') id: string, @GetCurrentUserId() adminId: string) {
    return this.adminService.unbanUser(adminId, id);
  }
}
