import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User } from '@prisma/client';
import { IPushSettingsQuery, IPushSettingsCommand } from './settings.interfaces.ts';
import { ApiException } from '../common/exceptions/api.exception.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

const SETTING_FIELDS = [
    'likeComment',
    'fromFriends',
    'requestedFriend',
    'suggestedFriend',
    'birthday',
    'video',
    'report',
    'soundOn',
    'notificationOn',
    'vibrantOn',
    'ledOn',
] as const;

@Injectable()
export class SettingsService implements IPushSettingsQuery, IPushSettingsCommand {
    constructor(private readonly prisma: PrismaService) {}

    async getPushSettings(user: User) {
        let settings = await this.prisma.pushSetting.findUnique({
            where: { userId: user.id },
        });

        if (!settings) {
            settings = await this.prisma.pushSetting.create({
                data: { userId: user.id },
            });
        }

        return {
            likeComment: String(settings.likeComment),
            fromFriends: String(settings.fromFriends),
            requestedFriend: String(settings.requestedFriend),
            suggestedFriend: String(settings.suggestedFriend),
            birthday: String(settings.birthday),
            video: String(settings.video),
            report: String(settings.report),
            soundOn: String(settings.soundOn),
            notificationOn: String(settings.notificationOn),
            vibrantOn: String(settings.vibrantOn),
            ledOn: String(settings.ledOn),
        };
    }

    async setPushSettings(user: User, data: Record<string, string | undefined>) {
        // Check that at least one setting field is present
        const hasAnyField = SETTING_FIELDS.some((field) => data[field] !== undefined);
        if (!hasAnyField) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'At least one setting parameter is required',
            );
        }

        // Validate all provided values are '0' or '1'
        for (const field of SETTING_FIELDS) {
            const value = data[field];
            if (value !== undefined && value !== '0' && value !== '1') {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    `Invalid value for ${field}: must be "0" or "1"`,
                );
            }
        }

        // Get current settings or create defaults
        let currentSettings = await this.prisma.pushSetting.findUnique({
            where: { userId: user.id },
        });

        if (!currentSettings) {
            currentSettings = await this.prisma.pushSetting.create({
                data: { userId: user.id },
            });
        }

        // Check if all provided values are the same as current
        let allSame = true;
        const updateData: Record<string, number> = {};

        for (const field of SETTING_FIELDS) {
            const value = data[field];
            if (value !== undefined) {
                const numValue = parseInt(value, 10);
                const currentValue = currentSettings[field];
                if (numValue !== currentValue) {
                    allSame = false;
                }
                updateData[field] = numValue;
            }
        }

        if (allSame && Object.keys(updateData).length > 0) {
            throw new ApiException(
                ResponseCode.ACTION_DONE_PREVIOUSLY,
                'All settings are already set to the requested values',
            );
        }

        // Update only the provided fields
        const updatedSettings = await this.prisma.pushSetting.update({
            where: { userId: user.id },
            data: updateData,
        });

        return {
            likeComment: String(updatedSettings.likeComment),
            fromFriends: String(updatedSettings.fromFriends),
            requestedFriend: String(updatedSettings.requestedFriend),
            suggestedFriend: String(updatedSettings.suggestedFriend),
            birthday: String(updatedSettings.birthday),
            video: String(updatedSettings.video),
            report: String(updatedSettings.report),
            soundOn: String(updatedSettings.soundOn),
            notificationOn: String(updatedSettings.notificationOn),
            vibrantOn: String(updatedSettings.vibrantOn),
            ledOn: String(updatedSettings.ledOn),
        };
    }
}
