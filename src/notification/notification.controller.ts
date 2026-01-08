import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { GetCurrentUserId } from '../common/decorators/get-current-user-id.decorator';
import { NotificationQueryDto } from './dto/notification.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, description: 'Return notifications.' })
  getUserNotifications(
    @GetCurrentUserId() userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Return unread count.' })
  getUnreadCount(@GetCurrentUserId() userId: string) {
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read.' })
  markAllAsRead(@GetCurrentUserId() userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  markAsRead(@GetCurrentUserId() userId: string, @Param('id') id: string) {
    return this.notificationService.markAsRead(id, userId);
  }
}
