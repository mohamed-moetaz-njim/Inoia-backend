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

@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Get('conversations')
  getUserConversations(@GetCurrentUserId() userId: string) {
    return this.aiChatService.getUserConversations(userId);
  }

  @Post('conversations')
  createConversation(@GetCurrentUserId() userId: string) {
    return this.aiChatService.createConversation(userId);
  }

  @Get('conversations/:id')
  getConversation(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.aiChatService.getConversation(userId, conversationId);
  }

  @Post('conversations/:id/message')
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
