import { ApiProperty } from '@nestjs/swagger';
import { AiMessageDto } from './ai-message.dto';

export class AiConversationSummaryDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  userId: string;

  @ApiProperty({ nullable: true, example: 'Dealing with anxiety' })
  title: string | null;

  @ApiProperty()
  lastActivityAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({
    type: [AiMessageDto],
    description: 'Contains the latest message as a preview',
  })
  messages: AiMessageDto[];
}
