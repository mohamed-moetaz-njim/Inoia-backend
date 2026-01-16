import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, ReportStatus } from '@prisma/client';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Reports')
@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reports')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a report' })
  @ApiResponse({ status: 201, description: 'Report successfully created.' })
  createReport(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportService.createReport(userId, dto);
  }

  @Roles(Role.ADMIN)
  @Get('admin/reports')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all reports (Admin)' })
  @ApiResponse({ status: 200, description: 'Return all reports.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ReportStatus })
  @ApiQuery({ name: 'type', required: false, enum: ['Post', 'Comment'] })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    const pageNum = page ? Math.max(1, +page) : 1;
    const limitNum = limit ? Math.max(1, +limit) : 20;
    const skip = (pageNum - 1) * limitNum;

    // Normalize status
    let normalizedStatus: ReportStatus | undefined;
    if (status) {
      const upperStatus = status.toUpperCase();
      if (Object.values(ReportStatus).includes(upperStatus as ReportStatus)) {
        normalizedStatus = upperStatus as ReportStatus;
      }
    }

    // Normalize type
    let normalizedType: 'Post' | 'Comment' | undefined;
    if (type) {
      // Allow "post", "POST", "Post" -> "Post"
      // Allow "comment", "COMMENT", "Comment" -> "Comment"
      const lowerType = type.toLowerCase();
      if (lowerType === 'post') normalizedType = 'Post';
      if (lowerType === 'comment') normalizedType = 'Comment';
    }

    return this.reportService.findAll(skip, limitNum, normalizedStatus, normalizedType);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/reports/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a report (Admin)' })
  @ApiResponse({ status: 200, description: 'Report successfully updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @GetCurrentUser('sub') adminId: string,
  ) {
    return this.reportService.update(id, dto, adminId);
  }
}
