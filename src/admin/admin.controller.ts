import { Controller, Post, Body, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { GetCurrentUserId, Roles } from '../common/decorators';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BanUserDto } from './dto/ban-user.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban a user' })
  @ApiResponse({ status: 200, description: 'User successfully banned.' })
  banUser(
    @Param('id') id: string,
    @GetCurrentUserId() adminId: string,
    @Body() dto: BanUserDto,
  ) {
    return this.adminService.banUser(adminId, id, dto.reason);
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: 'Unban a user' })
  @ApiResponse({ status: 200, description: 'User successfully unbanned.' })
  unbanUser(@Param('id') id: string, @GetCurrentUserId() adminId: string) {
    return this.adminService.unbanUser(adminId, id);
  }
}
