import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitVerificationDto {
  @ApiPropertyOptional({
    example: 'https://registry.psychology.org/users/12345',
    description: 'Link or reference to professional certification',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  certificationReference?: string;
}
