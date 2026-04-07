import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BlockService } from '../../src/users/block.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { User } from '@prisma/client';

const mockUser: User = {
    id: 'user-a',
    phonenumber: '0123456789',
    password: 'hash',
    username: 'userA',
    avatar: null,
    coverImage: null,
    description: null,
    role: UserRole.HV,
    token: 'tok-a',
    height: null,
    status: UserStatus.ACTIVE,
    online: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
};

const mockTarget: User = {
    ...mockUser,
    id: 'user-b',
    phonenumber: '0987654321',
    username: 'userB',
    token: 'tok-b',
};

const mockLockedTarget: User = {
    ...mockTarget,
    id: 'user-locked',
    status: UserStatus.LOCKED,
};

const mockPrisma = {
    user: {
        findUnique: jest.fn(),
    },
    block: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
    },
};

describe('BlockService', () => {
    let service: BlockService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [BlockService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<BlockService>(BlockService);
        prisma = module.get(PrismaService);
    });

    describe('setBlock', () => {
        it('TC1: should block user successfully (type=0)', async () => {
            prisma.user.findUnique.mockResolvedValue(mockTarget);
            prisma.block.findUnique.mockResolvedValue(null);
            prisma.block.create.mockResolvedValue({
                blockerId: mockUser.id,
                blockedId: mockTarget.id,
            });

            const result = await service.setBlock(mockUser, mockTarget.id, '0');

            expect(prisma.block.create).toHaveBeenCalledWith({
                data: {
                    blockerId: mockUser.id,
                    blockedId: mockTarget.id,
                },
            });
            expect(result).toEqual({});
        });

        it('TC1b: should unblock user successfully (type=1)', async () => {
            prisma.user.findUnique.mockResolvedValue(mockTarget);
            prisma.block.findUnique.mockResolvedValue({
                blockerId: mockUser.id,
                blockedId: mockTarget.id,
            });
            prisma.block.delete.mockResolvedValue({});

            const result = await service.setBlock(mockUser, mockTarget.id, '1');

            expect(prisma.block.delete).toHaveBeenCalled();
            expect(result).toEqual({});
        });

        it('TC5: should throw error when trying to block yourself', async () => {
            await expect(service.setBlock(mockUser, mockUser.id, '0')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC6: should throw error when target user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.setBlock(mockUser, 'nonexistent-id', '0')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('TC7: should throw error when target user is locked', async () => {
            prisma.user.findUnique.mockResolvedValue(mockLockedTarget);

            await expect(service.setBlock(mockUser, mockLockedTarget.id, '0')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC8: should throw error when type is invalid (not 0 or 1)', async () => {
            prisma.user.findUnique.mockResolvedValue(mockTarget);

            await expect(service.setBlock(mockUser, mockTarget.id, '2')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC9a: should throw error when blocking already blocked user', async () => {
            prisma.user.findUnique.mockResolvedValue(mockTarget);
            prisma.block.findUnique.mockResolvedValue({
                blockerId: mockUser.id,
                blockedId: mockTarget.id,
            });

            await expect(service.setBlock(mockUser, mockTarget.id, '0')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC9b: should throw error when unblocking user who was never blocked', async () => {
            prisma.user.findUnique.mockResolvedValue(mockTarget);
            prisma.block.findUnique.mockResolvedValue(null);

            await expect(service.setBlock(mockUser, mockTarget.id, '1')).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('isBlocked', () => {
        it('should return true if block exists', async () => {
            prisma.block.findUnique.mockResolvedValue({
                blockerId: mockUser.id,
                blockedId: mockTarget.id,
            });

            const result = await service.isBlocked(mockUser.id, mockTarget.id);
            expect(result).toBe(true);
        });

        it('should return false if block does not exist', async () => {
            prisma.block.findUnique.mockResolvedValue(null);

            const result = await service.isBlocked(mockUser.id, mockTarget.id);
            expect(result).toBe(false);
        });
    });
});
