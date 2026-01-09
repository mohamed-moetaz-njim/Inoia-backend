import { ApiProperty } from '@nestjs/swagger';
import { AiSender } from '@prisma/client';

export class AiMessageDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  conversationId: string;

  @ApiProperty({ enum: AiSender, example: AiSender.USER })
  sender: AiSender;

  @ApiProperty({ example: 'Hello, I feel overwhelmed.' })
  content: string;

  @ApiProperty()
  createdAt: Date;
}
