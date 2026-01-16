import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class UpdateReportDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsString()
  action?: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  actionNote?: string;

  @IsOptional()
  @IsBoolean()
  deleteContent?: boolean;
}
