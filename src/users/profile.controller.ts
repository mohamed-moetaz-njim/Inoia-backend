import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from '../common/decorators';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicProfileDto } from './dto/public-profile.dto';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Get(':username')
  @ApiOperation({
    summary: 'Get public profile of a user (extra details for verified therapists)',
  })
  @ApiResponse({
    status: 200,
    description: 'Return public profile.',
    type: PublicProfileDto,
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getPublicProfile(@Param('username') username: string) {
    return this.usersService.getPublicProfile(username);
  }
}
