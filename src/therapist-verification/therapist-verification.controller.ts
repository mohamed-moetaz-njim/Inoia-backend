import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { TherapistVerificationService } from './therapist-verification.service';
import { GetCurrentUserId, Roles } from '../common/decorators';
import { Role, VerificationStatus } from '@prisma/client';

@Controller('therapist-verification')
export class TherapistVerificationController {
  constructor(
    private readonly verificationService: TherapistVerificationService,
  ) {}

  @Post()
  submitRequest(
    @GetCurrentUserId() userId: string,
    @Body('certificationReference') certificationReference: string,
  ) {
    return this.verificationService.submitRequest(
      userId,
      certificationReference,
    );
  }

  @Get()
  @Roles(Role.ADMIN)
  listRequests(@Query('status') status?: VerificationStatus) {
    return this.verificationService.listRequests(status);
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN)
  approveRequest(@Param('id') id: string, @GetCurrentUserId() adminId: string) {
    return this.verificationService.approveRequest(id, adminId);
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN)
  rejectRequest(@Param('id') id: string, @GetCurrentUserId() adminId: string) {
    return this.verificationService.rejectRequest(id, adminId);
  }
}
