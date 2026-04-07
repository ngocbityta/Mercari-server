import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SettingsService } from './settings.service.ts';
import { GetPushSettingsDto, SetPushSettingsDto } from './settings.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import type { User } from '@prisma/client';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

@Controller()
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) {}

    @Post('get_push_settings')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getPushSettings(@Body() _dto: GetPushSettingsDto, @CurrentUser() user: User) {
        try {
            const result = await this.settingsService.getPushSettings(user);
            return ApiResponse.success(result);
        } catch {
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('set_push_settings')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setPushSettings(@Body() dto: SetPushSettingsDto, @CurrentUser() user: User) {
        try {
            const result = await this.settingsService.setPushSettings(user, {
                likeComment: dto.likeComment,
                fromFriends: dto.fromFriends,
                requestedFriend: dto.requestedFriend,
                suggestedFriend: dto.suggestedFriend,
                birthday: dto.birthday,
                video: dto.video,
                report: dto.report,
                soundOn: dto.soundOn,
                notificationOn: dto.notificationOn,
                vibrantOn: dto.vibrantOn,
                ledOn: dto.ledOn,
            });
            return ApiResponse.success(result);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'All settings are already set to the requested values') {
                    return ApiResponse.error(ResponseCode.ACTION_DONE_PREVIOUSLY, error.message);
                }
                return ApiResponse.error(ResponseCode.INVALID_PARAMETER_VALUE, error.message);
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }
}
