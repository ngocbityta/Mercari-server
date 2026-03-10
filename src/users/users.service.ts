import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateUserDto, UpdateUserDto } from './users.dto.ts';
import { UserStatus } from '../enums/users.enum.ts';
import { User } from '@prisma/client';

const BANNED_USERNAMES = ['hitier', 'admin', 'root', 'superadmin'];

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async create(createUserDto: CreateUserDto): Promise<User> {
        const existingUser = await this.prisma.user.findUnique({
            where: { phonenumber: createUserDto.phonenumber },
        });

        if (existingUser) {
            throw new ConflictException('Số điện thoại đã được đăng ký');
        }

        return this.prisma.user.create({
            data: {
                phonenumber: createUserDto.phonenumber,
                password: createUserDto.password,
                role: createUserDto.role,
                username: createUserDto.username,
                avatar: createUserDto.avatar,
                coverImage: createUserDto.coverImage,
                description: createUserDto.description,
            },
        });
    }

    async findAll(): Promise<User[]> {
        return this.prisma.user.findMany({
            select: {
                id: true,
                phonenumber: true,
                username: true,
                avatar: true,
                coverImage: true,
                description: true,
                role: true,
                status: true,
                online: true,
                createdAt: true,
                updatedAt: true,
                password: true, // Included for backward compatibility if needed, but select usually excludes password in TypeORM call
                token: true,
            },
        }) as unknown as Promise<User[]>; // Cast due to select
    }

    async findOne(id: string): Promise<User> {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException(`Không tìm thấy người dùng với id: ${id}`);
        }

        return user;
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user = await this.findOne(id);

        if (updateUserDto.phonenumber && updateUserDto.phonenumber !== user.phonenumber) {
            const existingUser = await this.prisma.user.findUnique({
                where: { phonenumber: updateUserDto.phonenumber },
            });

            if (existingUser) {
                throw new ConflictException('Số điện thoại đã được đăng ký');
            }
        }

        return this.prisma.user.update({
            where: { id },
            data: {
                phonenumber: updateUserDto.phonenumber,
                password: updateUserDto.password,
                role: updateUserDto.role,
                username: updateUserDto.username,
                avatar: updateUserDto.avatar,
                coverImage: updateUserDto.coverImage,
                description: updateUserDto.description,
                status: updateUserDto.status,
                online: updateUserDto.online,
            },
        });
    }

    async remove(id: string): Promise<void> {
        await this.findOne(id);
        await this.prisma.user.delete({
            where: { id },
        });
    }

    async getUserInfo(currentUser: User, targetUserId?: string) {
        if (!targetUserId || targetUserId === currentUser.id) {
            return this.formatUserInfo(currentUser);
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        if (!targetUser || targetUser.status === UserStatus.LOCKED) {
            throw new NotFoundException('User not found');
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
            throw new NotFoundException('User not found');
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
            throw new NotFoundException('User not found');
        }

        const updateData: {
            username?: string;
            avatar?: string;
            coverImage?: string;
            description?: string;
        } = {};

        if (data.username !== undefined) {
            const normalizedUsername = data.username.trim();

            if (normalizedUsername.length === 0) {
                throw new BadRequestException('Username cannot be empty');
            }

            const usernameRegex = /^[a-zA-Z_][a-zA-Z_]*$/;
            if (!usernameRegex.test(normalizedUsername)) {
                throw new BadRequestException(
                    'Username can only contain letters and underscores, must start with a letter or underscore',
                );
            }

            if (normalizedUsername.length > 50) {
                throw new BadRequestException('Username is too long');
            }

            if (BANNED_USERNAMES.includes(normalizedUsername.toLowerCase())) {
                throw new BadRequestException('This username is not allowed');
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

    async changePassword(user: User, password: string, newPassword: string) {
        if (password === newPassword) {
            throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ');
        }

        const isMatch = user.password === password;
        if (!isMatch) {
            throw new BadRequestException('Mật khẩu cũ không chính xác');
        }

        if (newPassword.length < 6 || newPassword.length > 50) {
            throw new BadRequestException('Mật khẩu mới phải từ 6 đến 50 ký tự');
        }

        const getLongestCommonSubstring = (s1: string, s2: string): number => {
            const m = s1.length;
            const n = s2.length;
            let maxLen = 0;
            const dp: number[][] = Array.from(
                { length: m + 1 },
                () => Array(n + 1).fill(0) as number[],
            );
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    if (s1[i - 1] === s2[j - 1]) {
                        dp[i][j] = dp[i - 1][j - 1] + 1;
                        maxLen = Math.max(maxLen, dp[i][j]);
                    }
                }
            }
            return maxLen;
        };

        const lcsLength = getLongestCommonSubstring(password, newPassword);
        if (lcsLength / newPassword.length >= 0.8) {
            throw new BadRequestException('Mật khẩu mới quá giống mật khẩu cũ');
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { password: newPassword },
        });

        return {};
    }

    async setBlock(currentUser: User, targetUserId: string, type: string) {
        if (currentUser.id === targetUserId) {
            throw new BadRequestException('Bạn không thể chặn chính mình');
        }

        const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        if (targetUser.status === UserStatus.LOCKED) {
            throw new BadRequestException('Người dùng này đã bị khóa');
        }

        if (type !== '0' && type !== '1') {
            throw new BadRequestException('Loại hành động không hợp lệ');
        }

        const existingBlock = await this.prisma.block.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId: currentUser.id,
                    blockedId: targetUserId,
                },
            },
        });

        if (type === '0') {
            if (existingBlock) {
                throw new BadRequestException('Bạn đã chặn người này rồi');
            }
            await this.prisma.block.create({
                data: {
                    blockerId: currentUser.id,
                    blockedId: targetUserId,
                },
            });
        } else {
            if (!existingBlock) {
                throw new BadRequestException('Bạn chưa từng chặn người này');
            }
            await this.prisma.block.delete({
                where: {
                    blockerId_blockedId: {
                        blockerId: currentUser.id,
                        blockedId: targetUserId,
                    },
                },
            });
        }

        return {};
    }

    checkNewVersion(user: User, lastUpdate: string) {
        if (!lastUpdate || typeof lastUpdate !== 'string') {
            throw new BadRequestException('Parameter last_update is required');
        }

        return {
            version: {
                version: '1.0.0',
                active: user.status === UserStatus.ACTIVE ? '1' : '0',
                required: '0',
                url: 'https://example.com/app',
            },
            user: {
                id: user.id,
                active: user.status === UserStatus.ACTIVE ? '1' : '0',
            },
            badge: '0',
            unread_message: '0',
            now: '1.0.0',
        };
    }

    private formatUserInfo(user: User) {
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
