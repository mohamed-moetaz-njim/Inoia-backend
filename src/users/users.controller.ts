import {
  Controller,
  Get,
  Post,
  Delete,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { GetCurrentUserId, Roles } from '../common/decorators';
import { generatePseudonym } from '../common/utils';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from './dto/user-response.dto';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'status', required: false, enum: ['Active', 'Banned'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Return list of users.' })
  async findAll(
    @Query('role') role?: Role,
    @Query('status') status?: 'Active' | 'Banned',
    @Query('search') search?: string,
  ) {
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (status) {
      where.isBanned = status === 'Banned';
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.usersService.findAll({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Return user profile.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getMe(@GetCurrentUserId() userId: string) {
    const user = await this.usersService.findProfile(userId);
    if (!user) throw new NotFoundException('User not found');
    return plainToInstance(UserResponseDto, user);
  }

  @Post('reroll-username')
  @ApiOperation({ summary: 'Reroll username (if not locked)' })
  @ApiResponse({ status: 201, description: 'Username rerolled.' })
  @ApiResponse({ status: 403, description: 'Username is locked.' })
  async rerollUsername(@GetCurrentUserId() userId: string) {
    const user = await this.usersService.findProfile(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.usernameLocked) throw new ForbiddenException('Username is locked');

    let username = generatePseudonym();
    // Ensure unique (simple retry)
    let retries = 5;
    while (retries > 0) {
      const exists = await this.usersService.findOne({ username });
      if (!exists) break;
      username = generatePseudonym();
      retries--;
    }

    const updatedUser = await this.usersService.update({
      where: { id: userId },
      data: { username },
    });

    return plainToInstance(UserResponseDto, updatedUser);
  }

  @Post('lock-username')
  @ApiOperation({ summary: 'Lock username' })
  @ApiResponse({ status: 201, description: 'Username locked.' })
  async lockUsername(@GetCurrentUserId() userId: string) {
    const updatedUser = await this.usersService.update({
      where: { id: userId },
      data: { usernameLocked: true },
    });
    return plainToInstance(UserResponseDto, updatedUser);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete account' })
  @ApiResponse({ status: 204, description: 'Account deleted.' })
  async deleteAccount(@GetCurrentUserId() userId: string) {
    await this.usersService.remove(userId);
  }
}
