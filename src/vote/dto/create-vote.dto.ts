import { IsInt, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateVoteDto {
  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  commentId?: string;

  @IsInt()
  @IsIn([1, -1])
  value: number;
}
