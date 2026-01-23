import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RegisterDto } from './auth.dto';

export class RegisterTherapistDto extends RegisterDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full real name of the therapist',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

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
