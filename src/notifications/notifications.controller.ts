import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service.ts';
import { GetNotificationDto, SetReadNotificationDto } from './dto/notification.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import { User } from '../entities/user.entity.ts';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../common/enums/response-code.enum.ts';

@Controller()
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Post('get_notification')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getNotification(@Body() dto: GetNotificationDto, @CurrentUser() user: User) {
        try {
            const index = parseInt(dto.index, 10);
            const count = parseInt(dto.count, 10);

            if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
                return ApiResponse.error(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Parameter value is invalid',
                );
            }

            const result = await this.notificationsService.getNotifications(user, index, count);
            return ApiResponse.success(result);
        } catch {
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('set_read_notification')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setReadNotification(@Body() dto: SetReadNotificationDto, @CurrentUser() user: User) {
        try {
            const result = await this.notificationsService.setReadNotification(
                user,
                dto.notification_id,
            );
            return ApiResponse.success(result);
        } catch {
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }
}
