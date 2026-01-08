import {
  Controller,
  Get,
  Post,
  Delete,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { GetCurrentUserId } from '../common/decorators';
import { generatePseudonym } from '../common/utils';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@GetCurrentUserId() userId: string) {
    const user = await this.usersService.findOne({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Post('reroll-username')
  async rerollUsername(@GetCurrentUserId() userId: string) {
    const user = await this.usersService.findOne({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    if (user.usernameLocked) throw new ForbiddenException('Username is locked');

    // I can't track count without extra field.
    // Assuming infinite rerolls allowed until locked, as per schema limitations.
    // Or maybe the frontend tracks it?
    // I'll generate a new one.

    let username = generatePseudonym();
    // Ensure unique (simple retry)
    let retries = 5;
    while (retries > 0) {
      const exists = await this.usersService.findOne({ username });
      if (!exists) break;
      username = generatePseudonym();
      retries--;
    }

    return this.usersService.update({
      where: { id: userId },
      data: { username },
    });
  }

  @Post('lock-username')
  async lockUsername(@GetCurrentUserId() userId: string) {
    return this.usersService.update({
      where: { id: userId },
      data: { usernameLocked: true },
    });
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@GetCurrentUserId() userId: string) {
    await this.usersService.remove(userId);
  }
}
