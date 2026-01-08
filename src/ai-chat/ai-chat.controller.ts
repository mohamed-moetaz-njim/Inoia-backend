import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { GetCurrentUserId } from '../common/decorators/get-current-user-id.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('AI Chat')
@ApiBearerAuth('JWT-auth')
@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all user conversations' })
  @ApiResponse({ status: 200, description: 'Return conversations.' })
  getUserConversations(@GetCurrentUserId() userId: string) {
    return this.aiChatService.getUserConversations(userId);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Start a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created.' })
  createConversation(@GetCurrentUserId() userId: string) {
    return this.aiChatService.createConversation(userId);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiResponse({ status: 200, description: 'Return conversation with messages.' })
  getConversation(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.aiChatService.getConversation(userId, conversationId);
  }

  @Post('conversations/:id/message')
  @ApiOperation({ summary: 'Send a message to the AI' })
  @ApiResponse({ status: 201, description: 'Message processed and AI replied.' })
  sendMessage(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.aiChatService.processUserMessage(
      userId,
      conversationId,
      createMessageDto.content,
    );
  }
}
