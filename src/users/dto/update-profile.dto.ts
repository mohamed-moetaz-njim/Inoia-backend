import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'User biography',
    example: 'I am a psychology student...',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Current workplace or university',
    example: 'University of Toronto',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  workplace?: string;

  @ApiPropertyOptional({
    description: 'Profession or field of study',
    example: 'Student',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  profession?: string;
}
