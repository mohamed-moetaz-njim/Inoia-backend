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
      // Allow resubmission after rejection by updating existing record
      return this.prisma.therapistVerification.update({
        where: { id: existing.id },
        data: {
          status: VerificationStatus.PENDING,
          certificationReference,
          createdAt: new Date(), // Reset timestamp for resubmitted requests
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
    const requests = await this.prisma.therapistVerification.findMany({
      where: status ? { status } : {},
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            profession: true,
            workplace: true,
            bio: true,
          },
        },
      },
    });

    return requests.map((req) => ({
      id: req.id,
      username: req.user.username,
      email: req.user.email,
      profession: req.user.profession,
      workplace: req.user.workplace,
      bio: req.user.bio,
      credentials: req.certificationReference, // Mapping certificationReference to credentials/documentUrl
      documentUrl: req.certificationReference,
      status: req.status,
      createdAt: req.createdAt,
    }));
  }

  async approveRequest(requestId: string, adminId: string) {
    const request = await this.prisma.therapistVerification.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');

    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

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
        },
      });

      await tx.adminAction.create({
        data: {
          adminId,
          actionType: 'REJECT_THERAPIST',
          targetUserId: request.userId,
        },
      });

      return updatedRequest;
    });
  }
}
