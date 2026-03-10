import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service.ts';
import { GetNotificationDto, SetReadNotificationDto } from './notifications.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import type { User } from '@prisma/client';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

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
                dto.notificationId,
            );
            return ApiResponse.success(result);
        } catch {
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }
}
