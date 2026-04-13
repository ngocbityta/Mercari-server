import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from '../../src/settings/settings.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { User, PushSetting } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

const mockUser: User = {
    id: 'user-id-123',
    phonenumber: '0123456789',
    password: 'hash',
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

const defaultPushSetting: PushSetting = {
    userId: mockUser.id,
    likeComment: 1,
    fromFriends: 1,
    requestedFriend: 1,
    suggestedFriend: 1,
    birthday: 1,
    video: 1,
    report: 1,
    soundOn: 1,
    notificationOn: 1,
    vibrantOn: 1,
    ledOn: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
    pushSetting: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
};

describe('SettingsService', () => {
    let service: SettingsService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [SettingsService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<SettingsService>(SettingsService);
        prisma = module.get(PrismaService);
    });

    describe('getPushSettings', () => {
        it('TC1: should return push settings for user with existing settings', async () => {
            prisma.pushSetting.findUnique.mockResolvedValue(defaultPushSetting);

            const result = await service.getPushSettings(mockUser);

            expect(result).toEqual({
                likeComment: '1',
                fromFriends: '1',
                requestedFriend: '1',
                suggestedFriend: '1',
                birthday: '1',
                video: '1',
                report: '1',
                soundOn: '1',
                notificationOn: '1',
                vibrantOn: '1',
                ledOn: '1',
            });
            expect(prisma.pushSetting.findUnique).toHaveBeenCalledWith({
                where: { userId: mockUser.id },
            });
        });

        it('TC2: should create default settings if user has none', async () => {
            prisma.pushSetting.findUnique.mockResolvedValue(null);
            prisma.pushSetting.create.mockResolvedValue(defaultPushSetting);

            const result = await service.getPushSettings(mockUser);

            expect(prisma.pushSetting.create).toHaveBeenCalledWith({
                data: { userId: mockUser.id },
            });
            expect(result.likeComment).toBe('1');
            expect(result.notificationOn).toBe('1');
        });
    });

    describe('setPushSettings', () => {
        it('TC1: should update push settings successfully with valid values', async () => {
            const updatedSetting = { ...defaultPushSetting, likeComment: 0 };
            prisma.pushSetting.findUnique.mockResolvedValue(defaultPushSetting);
            prisma.pushSetting.update.mockResolvedValue(updatedSetting);

            const result = await service.setPushSettings(mockUser, {
                likeComment: '0',
            });

            expect(prisma.pushSetting.update).toHaveBeenCalledWith({
                where: { userId: mockUser.id },
                data: { likeComment: 0 },
            });
            expect(result.likeComment).toBe('0');
        });

        it('TC5: should throw error if input contains invalid values (not 0 or 1)', async () => {
            const call = () => service.setPushSettings(mockUser, { likeComment: '2' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC5b: should throw error if input contains non-numeric values', async () => {
            const call = () => service.setPushSettings(mockUser, { likeComment: 'abc' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC6: should keep existing values for fields not provided', async () => {
            const updatedSetting = { ...defaultPushSetting, birthday: 0 };
            prisma.pushSetting.findUnique.mockResolvedValue(defaultPushSetting);
            prisma.pushSetting.update.mockResolvedValue(updatedSetting);

            await service.setPushSettings(mockUser, {
                birthday: '0',
            });

            // Should only include birthday in the update
            expect(prisma.pushSetting.update).toHaveBeenCalledWith({
                where: { userId: mockUser.id },
                data: { birthday: 0 },
            });
        });

        it('TC7: should throw error when no setting parameters are provided', async () => {
            const call = () => service.setPushSettings(mockUser, {});
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC8: should throw error if all values are same as current', async () => {
            prisma.pushSetting.findUnique.mockResolvedValue(defaultPushSetting);

            const call = () =>
                service.setPushSettings(mockUser, {
                    likeComment: '1',
                    fromFriends: '1',
                });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.ACTION_DONE_PREVIOUSLY);
            }
        });

        it('should create default settings before updating if none exist', async () => {
            prisma.pushSetting.findUnique.mockResolvedValue(null);
            prisma.pushSetting.create.mockResolvedValue(defaultPushSetting);
            const updatedSetting = { ...defaultPushSetting, soundOn: 0 };
            prisma.pushSetting.update.mockResolvedValue(updatedSetting);

            const result = await service.setPushSettings(mockUser, {
                soundOn: '0',
            });

            expect(prisma.pushSetting.create).toHaveBeenCalled();
            expect(prisma.pushSetting.update).toHaveBeenCalled();
            expect(result.soundOn).toBe('0');
        });
    });
});
