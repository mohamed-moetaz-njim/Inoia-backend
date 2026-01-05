import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsOptional()
  @IsUUID()
  commentId?: string;
}
