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
  UpdateCommentDto,
} from './dto/forum.dto';
import { GetCurrentUser, GetCurrentUserId, Public } from '../common/decorators';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { AtGuard } from '../common/guards';
import { JwtPayload } from '../auth/types';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Forum')
@Controller('forum')
@UseGuards(OptionalAuthGuard)
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'Get all posts' })
  @ApiResponse({ status: 200, description: 'Return all posts.' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @GetCurrentUser() user: JwtPayload | undefined,
  ) {
    return this.forumService.findAllPosts(query, user?.sub);
  }

  @Public()
  @Get('posts/:id')
  @ApiOperation({ summary: 'Get post by id' })
  @ApiResponse({ status: 200, description: 'Return the post.' })
  @ApiResponse({ status: 404, description: 'Post not found.' })
  async findOne(
    @Param('id') id: string,
    @GetCurrentUser() user: JwtPayload | undefined,
  ) {
    return this.forumService.findOnePost(id, user?.sub);
  }

  @Public()
  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Get comments for a post' })
  @ApiResponse({ status: 200, description: 'Return comments.' })
  async findComments(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    @GetCurrentUser() user: JwtPayload | undefined,
  ) {
    return this.forumService.findComments(id, query, user?.sub);
  }

  // --- Write Operations ---

  @Post('posts')
  @UseGuards(AtGuard, ThrottlerGuard)
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 posts per minute
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post successfully created.' })
  async createPost(
    @GetCurrentUserId() userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.forumService.createPost(userId, dto);
  }

  @Patch('posts/:id')
  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({ status: 200, description: 'Post successfully updated.' })
  async updatePost(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.forumService.updatePost(userId, id, dto);
  }

  @Delete('posts/:id')
  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a post' })
  @ApiResponse({ status: 200, description: 'Post successfully deleted.' })
  async deletePost(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.forumService.deletePost(userId, id);
  }

  @Post('posts/:id/comments')
  @UseGuards(AtGuard, ThrottlerGuard)
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 comments per minute
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiResponse({ status: 201, description: 'Comment successfully created.' })
  async createComment(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.forumService.createComment(userId, id, dto);
  }

  @Delete('comments/:id')
  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment successfully deleted.' })
  async deleteComment(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.forumService.deleteComment(userId, id);
  }

  @Patch('comments/:id')
  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment successfully updated.' })
  async updateComment(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.forumService.updateComment(userId, id, dto);
  }
}
