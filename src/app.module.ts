import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { AtGuard, RolesGuard } from './common/guards';
import { AdminModule } from './admin/admin.module';
import { TherapistVerificationModule } from './therapist-verification/therapist-verification.module';
import { ForumModule } from './forum/forum.module';
import { ReportModule } from './report/report.module';
import { NotificationModule } from './notification/notification.module';
import { VoteModule } from './vote/vote.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    CommonModule,
    AdminModule,
    TherapistVerificationModule,
    ForumModule,
    VoteModule,
    AiChatModule,
    ReportModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
