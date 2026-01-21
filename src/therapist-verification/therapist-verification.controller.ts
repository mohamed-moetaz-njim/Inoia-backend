import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { TherapistVerificationService } from './therapist-verification.service';
import { GetCurrentUserId, Roles } from '../common/decorators';
import { Role, VerificationStatus } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SubmitVerificationDto } from './dto/submit-verification.dto';

@ApiTags('Therapist Verification')
@ApiBearerAuth('JWT-auth')
@Controller('therapist-verification')
export class TherapistVerificationController {
  constructor(
    private readonly verificationService: TherapistVerificationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a therapist verification request' })
  @ApiResponse({ status: 201, description: 'Request submitted successfully.' })
  submitRequest(
    @GetCurrentUserId() userId: string,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.verificationService.submitRequest(
      userId,
      dto.certificationReference,
    );
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List verification requests (Admin)' })
  @ApiQuery({ name: 'status', enum: VerificationStatus, required: false })
  @ApiResponse({ status: 200, description: 'Return list of requests.' })
  listRequests(@Query('status') status?: VerificationStatus) {
    return this.verificationService.listRequests(status);
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve a verification request (Admin)' })
  @ApiResponse({ status: 200, description: 'Request approved.' })
  approveRequest(@Param('id') id: string, @GetCurrentUserId() adminId: string) {
    return this.verificationService.approveRequest(id, adminId);
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a verification request (Admin)' })
  @ApiResponse({ status: 200, description: 'Request rejected.' })
  rejectRequest(@Param('id') id: string, @GetCurrentUserId() adminId: string) {
    return this.verificationService.rejectRequest(id, adminId);
  }
}
