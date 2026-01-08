import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { VerificationStatus, Role, Prisma } from '@prisma/client';

@Injectable()
export class TherapistVerificationService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async submitRequest(userId: string, certificationReference: string) {
    const user = await this.usersService.findOne({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    // Check if pending exists
    const existing = await this.prisma.therapistVerification.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.status === VerificationStatus.PENDING) {
        throw new BadRequestException('Verification request already pending');
      }
      if (existing.status === VerificationStatus.APPROVED) {
        throw new BadRequestException('User already verified');
      }
      // If REJECTED, allow resubmit? Prompt doesn't specify. Assuming yes, by updating.
      return this.prisma.therapistVerification.update({
        where: { id: existing.id },
        data: {
          status: VerificationStatus.PENDING,
          certificationReference,
          createdAt: new Date(), // Reset timestamp? Or keep history? Schema has one record per user.
        },
      });
    }

    return this.prisma.therapistVerification.create({
      data: {
        userId,
        certificationReference,
        status: VerificationStatus.PENDING,
      },
    });
  }

  async listRequests(status?: VerificationStatus) {
    return this.prisma.therapistVerification.findMany({
      where: status ? { status } : {},
      include: { user: { select: { id: true, email: true, username: true } } },
    });
  }

  async approveRequest(requestId: string, adminId: string) {
    const request = await this.prisma.therapistVerification.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');

    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    // Transaction to approve and upgrade user
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedRequest = await tx.therapistVerification.update({
        where: { id: requestId },
        data: {
          status: VerificationStatus.APPROVED,
          verifiedByAdminId: adminId,
          verifiedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: request.userId },
        data: { role: Role.THERAPIST },
      });

      // Log admin action
      await tx.adminAction.create({
        data: {
          adminId,
          actionType: 'APPROVE_THERAPIST',
          targetUserId: request.userId,
        },
      });

      return updatedRequest;
    });
  }

  async rejectRequest(requestId: string, adminId: string, reason?: string) {
    const request = await this.prisma.therapistVerification.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedRequest = await tx.therapistVerification.update({
        where: { id: requestId },
        data: {
          status: VerificationStatus.REJECTED,
          verifiedByAdminId: adminId,
          verifiedAt: new Date(),
          // rejectionReason: reason, // Field does not exist in schema
        },
      });

      // Log admin action
      await tx.adminAction.create({
        data: {
          adminId,
          actionType: 'REJECT_THERAPIST',
          targetUserId: request.userId,
          // reason, // Field does not exist in schema
        },
      });

      return updatedRequest;
    });
  }
}
