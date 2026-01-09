import { ApiProperty } from '@nestjs/swagger';

export class AnalysisResultDto {
  @ApiProperty({ example: 'anxious' })
  emotionalState: string;

  @ApiProperty({ example: ['stress', 'work'] })
  themes: string[];

  @ApiProperty({ example: 3, description: 'Risk level from 0 to 10' })
  riskLevel: number;

  @ApiProperty({ example: 'Validate feelings and ask open-ended questions.' })
  recommendedApproach: string;
}
