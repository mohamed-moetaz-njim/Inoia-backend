import { Module } from '@nestjs/common';
import { TherapistVerificationService } from './therapist-verification.service';
import { TherapistVerificationController } from './therapist-verification.controller';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [UsersModule, PrismaModule],
  controllers: [TherapistVerificationController],
  providers: [TherapistVerificationService],
})
export class TherapistVerificationModule {}
