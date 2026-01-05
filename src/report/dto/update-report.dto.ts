import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class UpdateReportDto {
  @IsNotEmpty()
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  actionNote?: string;

  @IsOptional()
  @IsBoolean()
  deleteContent?: boolean;
}
