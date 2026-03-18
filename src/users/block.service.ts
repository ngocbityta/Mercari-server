import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User, UserStatus } from '@prisma/client';

@Injectable()
export class BlockService {
    constructor(private readonly prisma: PrismaService) {}

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
}
