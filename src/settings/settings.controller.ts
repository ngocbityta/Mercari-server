import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SettingsService } from './settings.service.ts';
import { GetPushSettingsDto, SetPushSettingsDto } from './settings.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import type { User } from '@prisma/client';
import { ApiResponse } from '../common/dto/api-response.dto.ts';

@Controller()
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) {}

    @Post('get_push_settings')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getPushSettings(@Body() _dto: GetPushSettingsDto, @CurrentUser() user: User) {
        const result = await this.settingsService.getPushSettings(user);
        return ApiResponse.success(result);
    }

    @Post('set_push_settings')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setPushSettings(@Body() dto: SetPushSettingsDto, @CurrentUser() user: User) {
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
    }
}
