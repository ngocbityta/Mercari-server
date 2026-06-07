import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from '../../src/users/profile.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { User } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

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
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    block: {
        findUnique: jest.fn(),
    },
    post: {
        count: jest.fn(),
    },
    enrollment: {
        findUnique: jest.fn(),
        count: jest.fn(),
    },
};

describe('ProfileService', () => {
    let service: ProfileService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        // Default mocks cho các query đếm (own profile)
        mockPrisma.post.count.mockResolvedValue(0);
        mockPrisma.enrollment.count.mockResolvedValue(0);
        mockPrisma.enrollment.findUnique.mockResolvedValue(null);
        mockPrisma.block.findUnique.mockResolvedValue(null);

        const module: TestingModule = await Test.createTestingModule({
            providers: [ProfileService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<ProfileService>(ProfileService);
        prisma = module.get(PrismaService);
    });

    describe('getUserInfo', () => {
        it('TC1: should return own user info when no userId provided', async () => {
            mockPrisma.post.count.mockResolvedValue(5);
            mockPrisma.enrollment.count.mockResolvedValue(3);

            const result = await service.getUserInfo(mockUser);

            expect(result).toEqual({
                id: mockUser.id,
                username: 'testuser',
                phonenumber: '0123456789',
                avatar: 'avatar-url',
                coverImage: 'cover-url',
                description: 'A description',
                role: UserRole.HV,
                online: '1',
                created: mockUser.createdAt.toISOString(),
                isRelated: '0',
                listing: '5',
                followed: '3',
                isBlocked: '0',
            });
        });

        it('TC1b: should return own user info when userId equals own id', async () => {
            const result = await service.getUserInfo(mockUser, mockUser.id);

            expect(result.id).toBe(mockUser.id);
            expect(result.phonenumber).toBe('0123456789');
            expect(result.role).toBe(UserRole.HV);
            expect(result.isBlocked).toBe('0');
        });

        it('TC2: should return other user info when valid userId provided', async () => {
            prisma.user.findUnique.mockResolvedValue(mockOtherUser);
            prisma.block.findUnique.mockResolvedValue(null);
            mockPrisma.enrollment.findUnique.mockResolvedValue(null);
            mockPrisma.post.count.mockResolvedValue(10);
            mockPrisma.enrollment.count.mockResolvedValue(2);

            const result = await service.getUserInfo(mockUser, mockOtherUser.id);

            expect(result.id).toBe(mockOtherUser.id);
            expect(result.username).toBe('otheruser');
            expect((result as any).phonenumber).toBeUndefined();
            expect(result.role).toBe(UserRole.HV);
            expect(result.isRelated).toBe('0');
            expect(result.listing).toBe('10');
            expect(result.followed).toBe('2');
            expect(result.isBlocked).toBe('0');
        });

        it('TC2b: should return isRelated=1 when enrollment exists between users', async () => {
            prisma.user.findUnique.mockResolvedValue(mockOtherUser);
            prisma.block.findUnique.mockResolvedValue(null);
            mockPrisma.enrollment.findUnique.mockResolvedValue({ id: 'enroll-1' });
            mockPrisma.post.count.mockResolvedValue(0);
            mockPrisma.enrollment.count.mockResolvedValue(0);

            const result = await service.getUserInfo(mockUser, mockOtherUser.id);

            expect(result.isRelated).toBe('1');
        });

        it('TC2c: should return isBlocked=1 when current user has blocked target', async () => {
            prisma.user.findUnique.mockResolvedValue(mockOtherUser);
            // 1st call: blockedByTarget = null, 2nd call: hasBlockedTarget = exists
            prisma.block.findUnique
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ blockerId: mockUser.id, blockedId: mockOtherUser.id });
            mockPrisma.enrollment.findUnique.mockResolvedValue(null);
            mockPrisma.post.count.mockResolvedValue(0);
            mockPrisma.enrollment.count.mockResolvedValue(0);

            const result = await service.getUserInfo(mockUser, mockOtherUser.id);

            expect(result.isBlocked).toBe('1');
        });

        it('TC5: should throw ApiException (NO_DATA) when target user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const call = () => service.getUserInfo(mockUser, 'nonexistent-id');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });

        it('TC5b: should throw ApiException (NO_DATA) when target user is locked', async () => {
            prisma.user.findUnique.mockResolvedValue(mockLockedUser);

            const call = () => service.getUserInfo(mockUser, mockLockedUser.id);
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });

        it('should throw ApiException (NO_DATA) when target user has blocked current user', async () => {
            prisma.user.findUnique.mockResolvedValue(mockOtherUser);
            prisma.block.findUnique.mockResolvedValue({
                blockerId: mockOtherUser.id,
                blockedId: mockUser.id,
            });

            const call = () => service.getUserInfo(mockUser, mockOtherUser.id);
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
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
            expect(result.role).toBe(UserRole.HV);
            expect(result.listing).toBe('0');
            expect(result.followed).toBe('0');
        });
    });

    describe('setUserInfo', () => {
        it('TC1: should update user info successfully', async () => {
            const updatedUser = { ...mockUser, username: 'newname' };
            prisma.user.findFirst.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.setUserInfo({
                token: mockUser.token ?? undefined,
                username: 'newname',
            });

            expect(result.username).toBe('newname');
            expect(prisma.user.update).toHaveBeenCalled();
        });

        it('TC5a: should throw error when username is empty', async () => {
            prisma.user.findFirst.mockResolvedValue(mockUser);

            const call = () =>
                service.setUserInfo({ token: mockUser.token ?? undefined, username: '' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC5b: should throw error when username contains numbers', async () => {
            prisma.user.findFirst.mockResolvedValue(mockUser);

            const call = () =>
                service.setUserInfo({ token: mockUser.token ?? undefined, username: 'test123' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC5c: should throw error when username contains special characters', async () => {
            prisma.user.findFirst.mockResolvedValue(mockUser);

            const call = () =>
                service.setUserInfo({ token: mockUser.token ?? undefined, username: 'test@user' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC5d: should throw error when username is too long', async () => {
            prisma.user.findFirst.mockResolvedValue(mockUser);
            const longName = 'a'.repeat(51);

            const call = () =>
                service.setUserInfo({ token: mockUser.token ?? undefined, username: longName });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC6: should trim and normalize username', async () => {
            const updatedUser = { ...mockUser, username: 'testname' };
            prisma.user.findFirst.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            await service.setUserInfo({
                token: mockUser.token ?? undefined,
                username: '  testname  ',
            });

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: mockUser.id },
                data: { username: 'testname' },
            });
        });

        it('TC8: should throw error for banned username', async () => {
            prisma.user.findFirst.mockResolvedValue(mockUser);

            const call = () =>
                service.setUserInfo({ token: mockUser.token ?? undefined, username: 'hitier' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC8b: should throw error for banned username (case insensitive)', async () => {
            prisma.user.findFirst.mockResolvedValue(mockUser);

            const call = () =>
                service.setUserInfo({ token: mockUser.token ?? undefined, username: 'Admin' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('should update avatar and cover image', async () => {
            const updatedUser = {
                ...mockUser,
                avatar: 'new-avatar',
                coverImage: 'new-cover',
            };
            prisma.user.findFirst.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.setUserInfo({
                token: mockUser.token ?? undefined,
                avatar: 'new-avatar',
                coverImage: 'new-cover',
            });

            expect(result.avatar).toBe('new-avatar');
            expect(result.coverImage).toBe('new-cover');
        });

        it('should update description', async () => {
            const updatedUser = { ...mockUser, description: 'New bio' };
            prisma.user.findFirst.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.setUserInfo({
                token: mockUser.token ?? undefined,
                description: 'New bio',
            });

            expect(result.description).toBe('New bio');
        });

        it('should throw error if user not found', async () => {
            prisma.user.findFirst.mockResolvedValue(null);

            const call = () =>
                service.setUserInfo({ token: mockUser.token ?? undefined, username: 'newname' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });

        it('TC5e: should accept username with underscores', async () => {
            const updatedUser = { ...mockUser, username: 'test_user' };
            prisma.user.findFirst.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.setUserInfo({
                token: mockUser.token ?? undefined,
                username: 'test_user',
            });

            expect(result.username).toBe('test_user');
        });
    });
});
