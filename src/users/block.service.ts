import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User, UserStatus } from '@prisma/client';
import { ApiException } from '../common/exceptions/api.exception.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

@Injectable()
export class BlockService {
    constructor(private readonly prisma: PrismaService) {}

    async setBlock(currentUser: User, targetUserId: string, type: string) {
        if (currentUser.id === targetUserId) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Bạn không thể chặn chính mình',
            );
        }

        const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Người dùng không tồn tại',
            );
        }

        if (targetUser.status === UserStatus.LOCKED) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Người dùng này đã bị khóa',
            );
        }

        if (type !== '0' && type !== '1') {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Loại hành động không hợp lệ',
            );
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
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Bạn đã chặn người này rồi',
                );
            }
            await this.prisma.block.create({
                data: {
                    blockerId: currentUser.id,
                    blockedId: targetUserId,
                },
            });
        } else {
            if (!existingBlock) {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Bạn chưa từng chặn người này',
                );
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

    async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
        const block = await this.prisma.block.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId,
                    blockedId,
                },
            },
        });
        return !!block;
    }

    async getListBlocks(currentUser: User, index?: string, count?: string, userId?: string) {
        let targetUserId = currentUser.id;

        if (userId && userId !== currentUser.id) {
            // Check if admin (GV)
            if (currentUser.role !== 'GV') {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Bạn không có quyền xem danh sách chặn của người khác',
                );
            }
            targetUserId = userId;
        }

        const skip = index ? parseInt(index) : 0;
        const take = count ? parseInt(count) : 20;

        const [blocks, total] = await Promise.all([
            this.prisma.block.findMany({
                where: { blockerId: targetUserId },
                include: {
                    blocked: {
                        select: {
                            id: true,
                            username: true,
                            avatar: true,
                        },
                    },
                },
                skip,
                take,
            }),
            this.prisma.block.count({
                where: { blockerId: targetUserId },
            }),
        ]);

        return {
            total: total.toString(),
            users: blocks.map((b) => ({
                id: b.blocked.id,
                name: b.blocked.username || '',
                avatar: b.blocked.avatar || '',
            })),
        };
    }
}
