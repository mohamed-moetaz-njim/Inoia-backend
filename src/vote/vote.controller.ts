import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { GetCurrentUserId } from '../common/decorators';
import { AtGuard } from '../common/guards';
import { VoteService } from './vote.service';
import { CreateVoteDto } from './dto/create-vote.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Votes')
@ApiBearerAuth('JWT-auth')
@UseGuards(AtGuard)
@Controller()
export class VoteController {
  constructor(private voteService: VoteService) {}

  @Post('votes')
  @ApiOperation({ summary: 'Vote on a post or comment' })
  @ApiResponse({ status: 201, description: 'Vote successfully recorded.' })
  async vote(@GetCurrentUserId() userId: string, @Body() dto: CreateVoteDto) {
    return this.voteService.vote(userId, dto);
  }

  @Get('posts/:id/vote')
  @ApiOperation({ summary: 'Get current user vote on a post' })
  @ApiResponse({ status: 200, description: 'Return vote status.' })
  async getPostVote(
    @GetCurrentUserId() userId: string,
    @Param('id') postId: string,
  ) {
    return this.voteService.getPostVote(userId, postId);
  }

  @Get('comments/:id/vote')
  @ApiOperation({ summary: 'Get current user vote on a comment' })
  @ApiResponse({ status: 200, description: 'Return vote status.' })
  async getCommentVote(
    @GetCurrentUserId() userId: string,
    @Param('id') commentId: string,
  ) {
    return this.voteService.getCommentVote(userId, commentId);
  }
}
