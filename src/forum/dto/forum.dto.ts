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

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  content: string;
}

export class UpdatePostDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  content: string;
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}

export class AuthorDto {
  username: string;
  role: Role;
  // Optional Therapist Profile
  therapistProfile?: {
    certificationReference?: string;
    // Add other public fields here if Schema had them (e.g. workplace, bio)
    // For now, schema only has certificationReference in TherapistVerification
    // But requirement says "Display name, Optional public profile fields (workplace, bio)"
    // The Schema `TherapistVerification` only has `certificationReference`.
    // I will expose `certificationReference` as a placeholder for "public profile".
  };
}

export class PostResponseDto {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: AuthorDto;
}

export class CommentResponseDto {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: AuthorDto;
}
