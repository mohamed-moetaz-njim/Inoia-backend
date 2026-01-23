import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { RegisterDto } from './auth.dto';

export class RegisterTherapistDto extends RegisterDto {
  @ApiPropertyOptional({
    example: 'https://registry.psychology.org/users/12345',
    description: 'Link or reference to professional certification (Optional)',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  certificationReference?: string;

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
