import { Test, TestingModule } from '@nestjs/testing';
import { BlockService } from '../../src/users/block.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { User, Block } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

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
        const call = () => service.getListBlocks(mockUser as unknown as User, '0', '20', 'user2');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
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
        const call = () => service.setBlock(mockUser as unknown as User, 'user1', '0');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect((e as ApiException).message).toBe('Bạn không thể chặn chính mình');
        }
    });

    it('should throw error when user not found (TC 6)', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
        const call = () => service.setBlock(mockUser as unknown as User, 'unknown', '0');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect((e as ApiException).message).toBe('Người dùng không tồn tại');
        }
    });

    it('should throw error when target user is locked (TC 7)', async () => {
        const lockedUser = { id: 'user2', status: 'LOCKED' };
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(lockedUser as unknown as User);
        const call = () => service.setBlock(mockUser as unknown as User, 'user2', '0');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect((e as ApiException).message).toBe('Người dùng này đã bị khóa');
        }
    });

    it('should throw error for invalid type (TC 8)', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(targetUser as unknown as User);
        const call = () => service.setBlock(mockUser as unknown as User, 'user2', '3');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect((e as ApiException).message).toBe('Loại hành động không hợp lệ');
        }
    });

    it('should throw error if blocking already blocked user (TC 9)', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(targetUser as unknown as User);
        jest.spyOn(prisma.block, 'findUnique').mockResolvedValue({} as unknown as Block);
        const call = () => service.setBlock(mockUser as unknown as User, 'user2', '0');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect((e as ApiException).message).toBe('Bạn đã chặn người này rồi');
        }
    });

    it('should throw error if unblocking user never blocked (TC 9)', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(targetUser as unknown as User);
        jest.spyOn(prisma.block, 'findUnique').mockResolvedValue(null);
        const call = () => service.setBlock(mockUser as unknown as User, 'user2', '1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect((e as ApiException).message).toBe('Bạn chưa từng chặn người này');
        }
    });
});
