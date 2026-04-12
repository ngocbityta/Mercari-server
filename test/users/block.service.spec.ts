import { Test, TestingModule } from '@nestjs/testing';
import { BlockService } from '../../src/users/block.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { User, Block } from '@prisma/client';

describe('BlockService - getListBlocks', () => {
    let service: BlockService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlockService,
                {
                    provide: PrismaService,
                    useValue: {
                        block: {
                            findMany: jest.fn(),
                            count: jest.fn(),
                        },
                        user: {
                            findUnique: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<BlockService>(BlockService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    const mockUser = { id: 'user1', role: 'HV', username: 'user1' };
    const mockAdmin = { id: 'admin1', role: 'GV', username: 'admin1' };

    it('should return list of blocks for current user', async () => {
        const mockBlocks = [
            {
                blocked: { id: 'target1', username: 'Target One', avatar: 'avatar1.jpg' },
            },
        ];
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue(mockBlocks as unknown as Block[]);
        jest.spyOn(prisma.block, 'count').mockResolvedValue(1);

        const result = await service.getListBlocks(mockUser as unknown as User);

        expect(result.total).toBe('1');
        expect(result.users).toHaveLength(1);
        expect(result.users[0].name).toBe('Target One');
    });

    it('should allow admin to see other user blocks', async () => {
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.block, 'count').mockResolvedValue(0);
        const findManySpy = jest.spyOn(prisma.block, 'findMany');

        await service.getListBlocks(mockAdmin as unknown as User, '0', '20', 'user2');

        expect(findManySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { blockerId: 'user2' },
            }),
        );
    });

    it('should throw error if non-admin tries to see other user blocks', async () => {
        await expect(
            service.getListBlocks(mockUser as unknown as User, '0', '20', 'user2'),
        ).rejects.toThrow(BadRequestException);
    });

    it('should handle pagination correctly', async () => {
        const findManySpy = jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.block, 'count').mockResolvedValue(0);

        await service.getListBlocks(mockUser as unknown as User, '10', '5');

        expect(findManySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 10,
                take: 5,
            }),
        );
    });
});

describe('BlockService - setBlock', () => {
    let service: BlockService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlockService,
                {
                    provide: PrismaService,
                    useValue: {
                        block: {
                            findUnique: jest.fn(),
                            create: jest.fn(),
                            delete: jest.fn(),
                        },
                        user: {
                            findUnique: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<BlockService>(BlockService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    const mockUser = { id: 'user1', status: 'ACTIVE' };
    const targetUser = { id: 'user2', status: 'ACTIVE' };

    it('should block a user successfully', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(targetUser as unknown as User);
        jest.spyOn(prisma.block, 'findUnique').mockResolvedValue(null);
        const createSpy = jest
            .spyOn(prisma.block, 'create')
            .mockResolvedValue({} as unknown as Block);

        await service.setBlock(mockUser as unknown as User, 'user2', '0');

        expect(createSpy).toHaveBeenCalled();
    });

    it('should unblock a user successfully', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(targetUser as unknown as User);
        jest.spyOn(prisma.block, 'findUnique').mockResolvedValue({
            blockerId: 'user1',
            blockedId: 'user2',
        } as unknown as Block);
        const deleteSpy = jest
            .spyOn(prisma.block, 'delete')
            .mockResolvedValue({} as unknown as Block);

        await service.setBlock(mockUser as unknown as User, 'user2', '1');

        expect(deleteSpy).toHaveBeenCalled();
    });

    it('should throw error when blocking self (TC 5)', async () => {
        await expect(service.setBlock(mockUser as unknown as User, 'user1', '0')).rejects.toThrow(
            'Bạn không thể chặn chính mình',
        );
    });

    it('should throw error when user not found (TC 6)', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
        await expect(service.setBlock(mockUser as unknown as User, 'unknown', '0')).rejects.toThrow(
            'Người dùng không tồn tại',
        );
    });

    it('should throw error when target user is locked (TC 7)', async () => {
        const lockedUser = { id: 'user2', status: 'LOCKED' };
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(lockedUser as unknown as User);
        await expect(service.setBlock(mockUser as unknown as User, 'user2', '0')).rejects.toThrow(
            'Người dùng này đã bị khóa',
        );
    });

    it('should throw error for invalid type (TC 8)', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(targetUser as unknown as User);
        await expect(service.setBlock(mockUser as unknown as User, 'user2', '3')).rejects.toThrow(
            'Loại hành động không hợp lệ',
        );
    });

    it('should throw error if blocking already blocked user (TC 9)', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(targetUser as unknown as User);
        jest.spyOn(prisma.block, 'findUnique').mockResolvedValue({} as unknown as Block);
        await expect(service.setBlock(mockUser as unknown as User, 'user2', '0')).rejects.toThrow(
            'Bạn đã chặn người này rồi',
        );
    });

    it('should throw error if unblocking user never blocked (TC 9)', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(targetUser as unknown as User);
        jest.spyOn(prisma.block, 'findUnique').mockResolvedValue(null);
        await expect(service.setBlock(mockUser as unknown as User, 'user2', '1')).rejects.toThrow(
            'Bạn chưa từng chặn người này',
        );
    });
});
