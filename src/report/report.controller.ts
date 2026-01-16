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
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('status') status?: ReportStatus,
    @Query('type') type?: 'Post' | 'Comment',
  ) {
    return this.reportService.findAll(+page, +limit, status, type);
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
