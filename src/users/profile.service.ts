import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User, UserStatus } from '@prisma/client';
import { ApiException } from '../common/exceptions/api.exception.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

@Injectable()
export class ProfileService {
    constructor(private readonly prisma: PrismaService) {}

    async getUserInfo(currentUser: User, targetUserId?: string) {
        const isOwnProfile = !targetUserId || targetUserId === currentUser.id;

        if (isOwnProfile) {
            const [listing, followed] = await Promise.all([
                this.prisma.post.count({ where: { ownerId: currentUser.id } }),
                currentUser.role === 'GV'
                    ? this.prisma.enrollment.count({ where: { teacherId: currentUser.id } })
                    : this.prisma.enrollment.count({ where: { studentId: currentUser.id } }),
            ]);

            return this.formatUserInfo(currentUser, {
                showPhone: true,
                isRelated: false,
                isBlocked: false,
                listing,
                followed,
            });
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        if (!targetUser || targetUser.status === UserStatus.LOCKED) {
            throw new ApiException(ResponseCode.NO_DATA, 'User not found');
        }

        // Kiểm tra targetUser có block currentUser không
        const blockedByTarget = await this.prisma.block.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId: targetUserId,
                    blockedId: currentUser.id,
                },
            },
        });

        if (blockedByTarget) {
            throw new ApiException(ResponseCode.NO_DATA, 'User not found');
        }

        // Kiểm tra currentUser có block targetUser không
        const hasBlockedTarget = await this.prisma.block.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId: currentUser.id,
                    blockedId: targetUserId,
                },
            },
        });

        // Kiểm tra quan hệ GV-HV (isRelated)
        const enrollmentWhere =
            currentUser.role === 'HV'
                ? { studentId_teacherId: { studentId: currentUser.id, teacherId: targetUserId } }
                : { studentId_teacherId: { studentId: targetUserId, teacherId: currentUser.id } };

        const [enrollment, listing, followed] = await Promise.all([
            this.prisma.enrollment.findUnique({ where: enrollmentWhere }),
            this.prisma.post.count({ where: { ownerId: targetUserId } }),
            targetUser.role === 'GV'
                ? this.prisma.enrollment.count({ where: { teacherId: targetUserId } })
                : this.prisma.enrollment.count({ where: { studentId: targetUserId } }),
        ]);

        return this.formatUserInfo(targetUser, {
            showPhone: false,
            isRelated: !!enrollment,
            isBlocked: !!hasBlockedTarget,
            listing,
            followed,
        });
    }

    async setUserInfo(data: {
        token?: string;
        username?: string;
        avatar?: string;
        coverImage?: string;
        description?: string;
    }) {
        const user = await this.prisma.user.findFirst({
            where: { token: data.token },
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
            where: { id: user.id },
            data: updateData,
        });

        if (
            data.avatar !== undefined &&
            user.avatar &&
            user.avatar !== 'default_avatar.jpg' &&
            user.avatar !== data.avatar
        ) {
            try {
                await this.prisma.notification.updateMany({
                    where: { avatar: user.avatar },
                    data: { avatar: data.avatar },
                });
            } catch (error) {
                console.error('Lỗi khi cập nhật avatar trong notification', error);
            }
        }

        return this.formatUserInfo(savedUser, { showPhone: true });
    }

    formatUserInfo(
        user: User,
        extras: {
            showPhone?: boolean;
            isRelated?: boolean;
            isBlocked?: boolean;
            listing?: number;
            followed?: number;
        } = {},
    ) {
        const {
            showPhone = false,
            isRelated = false,
            isBlocked = false,
            listing = 0,
            followed = 0,
        } = extras;

        return {
            id: user.id,
            username: user.username ?? '',
            ...(showPhone && { phonenumber: user.phonenumber }),
            avatar: user.avatar ?? '',
            coverImage: user.coverImage ?? '',
            description: user.description ?? '',
            role: user.role,
            online: user.online ? '1' : '0',
            created: user.createdAt?.toISOString() ?? '',
            isRelated: isRelated ? '1' : '0',
            listing: String(listing),
            followed: String(followed),
            isBlocked: isBlocked ? '1' : '0',
        };
    }
}
