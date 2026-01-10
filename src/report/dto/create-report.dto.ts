import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({
    example: 'Inappropriate content',
    description: 'Reason for report',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Target Post ID' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({ description: 'Target Comment ID' })
  @IsOptional()
  @IsUUID()
  commentId?: string;
}
