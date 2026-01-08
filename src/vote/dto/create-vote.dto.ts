import { IsInt, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVoteDto {
  @ApiPropertyOptional({ description: 'Target Post ID' })
  @IsOptional()
  @IsString()
  postId?: string;

  @ApiPropertyOptional({ description: 'Target Comment ID' })
  @IsOptional()
  @IsString()
  commentId?: string;

  @ApiProperty({ example: 1, description: '1 for upvote, -1 for downvote' })
  @IsInt()
  @IsIn([1, -1])
  value: number;
}
