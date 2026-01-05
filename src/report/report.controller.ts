import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, ReportStatus } from '@prisma/client';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @UseGuards(ThrottlerGuard)
  @Post('reports')
  createReport(@GetCurrentUser('sub') userId: string, @Body() dto: CreateReportDto) {
    return this.reportService.createReport(userId, dto);
  }

  @Roles(Role.ADMIN)
  @Get('admin/reports')
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('status') status?: ReportStatus,
  ) {
    return this.reportService.findAll(+page, +limit, status);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/reports/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @GetCurrentUser('sub') adminId: string,
  ) {
    return this.reportService.update(id, dto, adminId);
  }
}
