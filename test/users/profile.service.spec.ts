import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileService } from '../../src/users/profile.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { User } from '@prisma/client';

const mockUser: User = {
    id: 'user-a',
    phonenumber: '0123456789',
    password: 'hash',
    username: 'testuser',
    avatar: 'avatar-url',
    coverImage: 'cover-url',
    description: 'A description',
    role: UserRole.HV,
    token: 'tok-a',
    height: null,
    status: UserStatus.ACTIVE,
    online: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
};

const mockOtherUser: User = {
    ...mockUser,
    id: 'user-b',
    phonenumber: '0987654321',
    username: 'otheruser',
    token: 'tok-b',
};

const mockLockedUser: User = {
    ...mockUser,
    id: 'user-locked',
    status: UserStatus.LOCKED,
};

const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    block: {
        findUnique: jest.fn(),
    },
};

describe('ProfileService', () => {
    let service: ProfileService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [ProfileService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<ProfileService>(ProfileService);
        prisma = module.get(PrismaService);
    });

    describe('getUserInfo', () => {
        it('TC1: should return own user info when no userId provided', async () => {
            const result = await service.getUserInfo(mockUser);

            expect(result).toEqual({
                id: mockUser.id,
                username: 'testuser',
                avatar: 'avatar-url',
                coverImage: 'cover-url',
                description: 'A description',
                online: '1',
                created: mockUser.createdAt.toISOString(),
            });
        });

        it('TC1b: should return own user info when userId equals own id', async () => {
            const result = await service.getUserInfo(mockUser, mockUser.id);

            expect(result.id).toBe(mockUser.id);
        });

        it('TC2: should return other user info when valid userId provided', async () => {
            prisma.user.findUnique.mockResolvedValue(mockOtherUser);
            prisma.block.findUnique.mockResolvedValue(null);

            const result = await service.getUserInfo(mockUser, mockOtherUser.id);

            expect(result.id).toBe(mockOtherUser.id);
            expect(result.username).toBe('otheruser');
        });

        it('TC5: should throw NotFoundException when target user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.getUserInfo(mockUser, 'nonexistent-id')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('TC5b: should throw NotFoundException when target user is locked', async () => {
            prisma.user.findUnique.mockResolvedValue(mockLockedUser);

            await expect(service.getUserInfo(mockUser, mockLockedUser.id)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw NotFoundException when target user has blocked current user', async () => {
            prisma.user.findUnique.mockResolvedValue(mockOtherUser);
            prisma.block.findUnique.mockResolvedValue({
                blockerId: mockOtherUser.id,
                blockedId: mockUser.id,
            });

            await expect(service.getUserInfo(mockUser, mockOtherUser.id)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should return default empty strings for null fields', async () => {
            const userWithNulls: User = {
                ...mockUser,
                username: null,
                avatar: null,
                coverImage: null,
                description: null,
            };

            const result = await service.getUserInfo(userWithNulls);

            expect(result.username).toBe('');
            expect(result.avatar).toBe('');
            expect(result.coverImage).toBe('');
            expect(result.description).toBe('');
        });
    });

    describe('setUserInfo', () => {
        it('TC1: should update user info successfully', async () => {
            const updatedUser = { ...mockUser, username: 'newname' };
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.setUserInfo(mockUser, {
                username: 'newname',
            });

            expect(result.username).toBe('newname');
            expect(prisma.user.update).toHaveBeenCalled();
        });

        it('TC5a: should throw error when username is empty', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.setUserInfo(mockUser, { username: '' })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC5b: should throw error when username contains numbers', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.setUserInfo(mockUser, { username: 'test123' })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC5c: should throw error when username contains special characters', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.setUserInfo(mockUser, { username: 'test@user' })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC5d: should throw error when username is too long', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            const longName = 'a'.repeat(51);

            await expect(service.setUserInfo(mockUser, { username: longName })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC6: should trim and normalize username', async () => {
            const updatedUser = { ...mockUser, username: 'testname' };
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            await service.setUserInfo(mockUser, {
                username: '  testname  ',
            });

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: mockUser.id },
                data: { username: 'testname' },
            });
        });

        it('TC8: should throw error for banned username', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.setUserInfo(mockUser, { username: 'hitier' })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC8b: should throw error for banned username (case insensitive)', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.setUserInfo(mockUser, { username: 'Admin' })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should update avatar and cover image', async () => {
            const updatedUser = {
                ...mockUser,
                avatar: 'new-avatar',
                coverImage: 'new-cover',
            };
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.setUserInfo(mockUser, {
                avatar: 'new-avatar',
                coverImage: 'new-cover',
            });

            expect(result.avatar).toBe('new-avatar');
            expect(result.coverImage).toBe('new-cover');
        });

        it('should update description', async () => {
            const updatedUser = { ...mockUser, description: 'New bio' };
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.setUserInfo(mockUser, {
                description: 'New bio',
            });

            expect(result.description).toBe('New bio');
        });

        it('should throw error if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.setUserInfo(mockUser, { username: 'newname' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('TC5e: should accept username with underscores', async () => {
            const updatedUser = { ...mockUser, username: 'test_user' };
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.setUserInfo(mockUser, {
                username: 'test_user',
            });

            expect(result.username).toBe('test_user');
        });
    });
});
