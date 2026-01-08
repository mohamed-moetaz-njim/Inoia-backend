import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ForumService } from './forum.service';
import {
  CreateCommentDto,
  CreatePostDto,
  PaginationQueryDto,
  UpdatePostDto,
} from './dto/forum.dto';
import { GetCurrentUser, GetCurrentUserId, Public } from '../common/decorators';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { AtGuard } from '../common/guards';
import { JwtPayload } from '../auth/types';
import { Throttle } from '@nestjs/throttler';

@Controller('forum')
@UseGuards(OptionalAuthGuard)
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Public()
  @Get('posts')
  async findAll(
    @Query() query: PaginationQueryDto,
    @GetCurrentUser() user: JwtPayload | undefined,
  ) {
    return this.forumService.findAllPosts(query, user?.sub);
  }

  @Public()
  @Get('posts/:id')
  async findOne(
    @Param('id') id: string,
    @GetCurrentUser() user: JwtPayload | undefined,
  ) {
    return this.forumService.findOnePost(id, user?.sub);
  }

  @Public()
  @Get('posts/:id/comments')
  async findComments(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    @GetCurrentUser() user: JwtPayload | undefined,
  ) {
    return this.forumService.findComments(id, query, user?.sub);
  }

  // --- Write Operations ---

  @Post('posts')
  @UseGuards(AtGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 posts per minute
  async createPost(
    @GetCurrentUserId() userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.forumService.createPost(userId, dto);
  }

  @Patch('posts/:id')
  @UseGuards(AtGuard)
  async updatePost(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.forumService.updatePost(userId, id, dto);
  }

  @Delete('posts/:id')
  @UseGuards(AtGuard)
  async deletePost(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.forumService.deletePost(userId, id);
  }

  @Post('posts/:id/comments')
  @UseGuards(AtGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 comments per minute
  async createComment(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.forumService.createComment(userId, id, dto);
  }

  @Delete('comments/:id')
  @UseGuards(AtGuard)
  async deleteComment(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.forumService.deleteComment(userId, id);
  }
}
