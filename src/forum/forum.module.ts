import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, NotificationModule, UsersModule],
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
