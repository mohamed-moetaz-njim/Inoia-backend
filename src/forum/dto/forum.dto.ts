import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

export class CreatePostDto {
  @ApiProperty({
    example: 'How do I deal with exam stress?',
    description: 'Post title',
    minLength: 5,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @ApiProperty({
    example: 'I have been feeling really overwhelmed lately...',
    description: 'Post content',
    minLength: 10,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  content: string;
}

export class UpdatePostDto {
  @ApiProperty({
    example: 'Updated content...',
    description: 'Post content',
    minLength: 10,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  content: string;
}

export class CreateCommentDto {
  @ApiProperty({
    example: 'Try deep breathing exercises.',
    description: 'Comment content',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}

export class AuthorDto {
  @ApiProperty()
  username: string;

  @ApiProperty({ enum: Role })
  role: Role;

  // Optional Therapist Profile
  @ApiPropertyOptional()
  therapistProfile?: {
    certificationReference?: string;
  };
}

export class PostResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  author: AuthorDto;
}

export class CommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  author: AuthorDto;
}
