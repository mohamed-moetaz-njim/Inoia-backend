import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RecentPostDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  createdAt: Date;
}

export class RecentCommentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  postId: string;

  @ApiProperty()
  postTitle: string;

  @ApiProperty()
  excerpt: string;

  @ApiProperty()
  createdAt: Date;
}

export class PublicProfileDto {
  @ApiProperty()
  username: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  roleBadge: string;

  @ApiProperty()
  joinedDate: string;

  // Optional fields for verified therapists
  @ApiProperty({ required: false })
  profession?: string;

  @ApiProperty({ required: false })
  workplace?: string;

  @ApiProperty({ required: false })
  bio?: string;

  @ApiProperty({ required: false })
  verificationBadge?: string;

  @ApiProperty({ type: [RecentPostDto], required: false })
  recentPosts?: RecentPostDto[];

  @ApiProperty({ type: [RecentCommentDto], required: false })
  recentComments?: RecentCommentDto[];
}
