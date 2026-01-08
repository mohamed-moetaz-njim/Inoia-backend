import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { GetCurrentUserId } from '../common/decorators/get-current-user-id.decorator';
import { NotificationQueryDto } from './dto/notification.dto';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getUserNotifications(
    @GetCurrentUserId() userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Get('unread-count')
  getUnreadCount(@GetCurrentUserId() userId: string) {
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch('read-all')
  markAllAsRead(@GetCurrentUserId() userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  markAsRead(@GetCurrentUserId() userId: string, @Param('id') id: string) {
    return this.notificationService.markAsRead(id, userId);
  }
}
