import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AccountService } from '../../src/users/account.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { User } from '@prisma/client';

const mockUser: User = {
    id: 'user-id-123',
    phonenumber: '0123456789',
    password: 'password1',
    username: 'testu',
    avatar: null,
    coverImage: null,
    description: null,
    role: UserRole.HV,
    token: 'token123',
    height: null,
    status: UserStatus.ACTIVE,
    online: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
    user: {
        update: jest.fn(),
    },
};

describe('AccountService', () => {
    let service: AccountService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [AccountService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<AccountService>(AccountService);
        prisma = module.get(PrismaService);
    });

    describe('changePassword', () => {
        it('TC1: should change password successfully with valid old and new password', async () => {
            prisma.user.update.mockResolvedValue({
                ...mockUser,
                password: 'newpass2',
            });

            const result = await service.changePassword(mockUser, 'password1', 'newpass2');

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: mockUser.id },
                data: { password: 'newpass2' },
            });
            expect(result).toEqual({});
        });

        it('TC5: should throw error when old password is incorrect', async () => {
            await expect(service.changePassword(mockUser, 'wrongpass', 'newpass2')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC7a: should throw error when new password is too short', async () => {
            await expect(service.changePassword(mockUser, 'password1', 'ab')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('TC7b: should throw error when new password is too long', async () => {
            await expect(
                service.changePassword(
                    mockUser,
                    'password1',
                    'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('TC8: should throw error when new password is too similar to old (LCS >= 80%)', async () => {
            // password1 vs password2 -> LCS = "password" = 8 chars, new pwd len 9, 8/9 = 88%
            await expect(
                service.changePassword(mockUser, 'password1', 'password2'),
            ).rejects.toThrow(BadRequestException);
        });

        it('TC9: should throw error when new password is same as old password', async () => {
            await expect(
                service.changePassword(mockUser, 'password1', 'password1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should accept password when LCS is below 80%', async () => {
            prisma.user.update.mockResolvedValue({
                ...mockUser,
                password: 'xyzthing',
            });

            const result = await service.changePassword(mockUser, 'password1', 'xyzthing');
            expect(result).toEqual({});
        });
    });

    describe('checkNewVersion', () => {
        it('TC1: should return version info with valid last_update', () => {
            const result = service.checkNewVersion(mockUser, '1.0.0');

            expect(result).toHaveProperty('version');
            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('badge');
            expect(result).toHaveProperty('unread_message');
            expect(result).toHaveProperty('now');
            expect(result.version.version).toBe('1.0.0');
            expect(result.user.id).toBe(mockUser.id);
            expect(result.user.active).toBe('1');
        });

        it('TC5: should throw error when last_update is missing', () => {
            expect(() => service.checkNewVersion(mockUser, '')).toThrow(BadRequestException);
        });

        it('TC7: should return active=0 for locked user', () => {
            const lockedUser = { ...mockUser, status: UserStatus.LOCKED };
            const result = service.checkNewVersion(lockedUser, '1.0.0');

            expect(result.version.active).toBe('0');
            expect(result.user.active).toBe('0');
        });

        it('should return valid now field', () => {
            const result = service.checkNewVersion(mockUser, '0.9.0');
            expect(result.now).toBeDefined();
            expect(typeof result.now).toBe('string');
        });
    });
});
