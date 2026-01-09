import { ApiProperty } from '@nestjs/swagger';
import { AiMessageDto } from './ai-message.dto';
import { AnalysisResultDto } from './analysis-result.dto';

export class SendMessageResponseDto {
  @ApiProperty({ type: AiMessageDto })
  userMessage: AiMessageDto;

  @ApiProperty({ type: AiMessageDto })
  aiMessage: AiMessageDto;

  @ApiProperty({ type: AnalysisResultDto })
  analysis: AnalysisResultDto;
}
