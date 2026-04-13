import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User, UserStatus } from '@prisma/client';
import { ApiException } from '../common/exceptions/api.exception.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

@Injectable()
export class ProfileService {
    constructor(private readonly prisma: PrismaService) {}

    async getUserInfo(currentUser: User, targetUserId?: string) {
        if (!targetUserId || targetUserId === currentUser.id) {
            return this.formatUserInfo(currentUser);
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        if (!targetUser || targetUser.status === UserStatus.LOCKED) {
            throw new ApiException(ResponseCode.NO_DATA, 'User not found');
        }

        const isBlocked = await this.prisma.block.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId: targetUserId,
                    blockedId: currentUser.id,
                },
            },
        });

        if (isBlocked) {
            throw new ApiException(ResponseCode.NO_DATA, 'User not found');
        }

        return this.formatUserInfo(targetUser);
    }

    async setUserInfo(
        currentUser: User,
        data: { username?: string; avatar?: string; coverImage?: string; description?: string },
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: currentUser.id },
        });

        if (!user) {
            throw new ApiException(ResponseCode.NO_DATA, 'User not found');
        }

        const updateData: {
            username?: string;
            avatar?: string;
            coverImage?: string;
            description?: string;
        } = {};
        const BANNED_USERNAMES = ['hitier', 'admin', 'root', 'superadmin'];

        if (data.username !== undefined) {
            const normalizedUsername = data.username.trim();
            if (normalizedUsername.length === 0) {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Username cannot be empty',
                );
            }
            const usernameRegex = /^[a-zA-Z_][a-zA-Z_]*$/;
            if (!usernameRegex.test(normalizedUsername)) {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Username can only contain letters and underscores, must start with a letter or underscore',
                );
            }
            if (normalizedUsername.length > 50) {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Username is too long',
                );
            }
            if (BANNED_USERNAMES.includes(normalizedUsername.toLowerCase())) {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'This username is not allowed',
                );
            }
            updateData.username = normalizedUsername;
        }

        if (data.avatar !== undefined) {
            updateData.avatar = data.avatar;
        }
        if (data.coverImage !== undefined) {
            updateData.coverImage = data.coverImage;
        }
        if (data.description !== undefined) {
            updateData.description = data.description;
        }

        const savedUser = await this.prisma.user.update({
            where: { id: currentUser.id },
            data: updateData,
        });

        return this.formatUserInfo(savedUser);
    }

    formatUserInfo(user: User) {
        return {
            id: user.id,
            username: user.username ?? '',
            avatar: user.avatar ?? '',
            coverImage: user.coverImage ?? '',
            description: user.description ?? '',
            online: user.online ? '1' : '0',
            created: user.createdAt?.toISOString() ?? '',
        };
    }
}
