import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { GetCurrentUserId } from '../common/decorators';
import { AtGuard } from '../common/guards';
import { VoteService } from './vote.service';
import { CreateVoteDto } from './dto/create-vote.dto';

@UseGuards(AtGuard)
@Controller()
export class VoteController {
  constructor(private voteService: VoteService) {}

  @Post('votes')
  async vote(@GetCurrentUserId() userId: string, @Body() dto: CreateVoteDto) {
    return this.voteService.vote(userId, dto);
  }

  @Get('posts/:id/vote')
  async getPostVote(
    @GetCurrentUserId() userId: string,
    @Param('id') postId: string,
  ) {
    return this.voteService.getPostVote(userId, postId);
  }

  @Get('comments/:id/vote')
  async getCommentVote(
    @GetCurrentUserId() userId: string,
    @Param('id') commentId: string,
  ) {
    return this.voteService.getCommentVote(userId, commentId);
  }
}
