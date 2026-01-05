import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
