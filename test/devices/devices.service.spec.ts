import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from '../../src/devices/devices.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { User, Device } from '@prisma/client';

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

const mockDevice: Device = {
    id: 'dev-1',
    userId: mockUser.id,
    devtype: 1,
    devToken: 'token-abc',
};

const mockPrisma = {
    device: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
};

describe('DevicesService', () => {
    let service: DevicesService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DevicesService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<DevicesService>(DevicesService);
        prisma = module.get(PrismaService);
    });

    describe('setDevtoken', () => {
        it('TC1: should create new device token if it does not exist', async () => {
            prisma.device.findUnique.mockResolvedValue(null);
            prisma.device.create.mockResolvedValue(mockDevice);

            const result = await service.setDevtoken(mockUser, 1, 'token-abc');

            expect(prisma.device.findUnique).toHaveBeenCalledWith({
                where: {
                    userId_devToken: {
                        userId: mockUser.id,
                        devToken: 'token-abc',
                    },
                },
            });
            expect(prisma.device.create).toHaveBeenCalledWith({
                data: {
                    userId: mockUser.id,
                    devtype: 1,
                    devToken: 'token-abc',
                },
            });
            expect(result.devToken).toBe('token-abc');
            expect(result.devtype).toBe('1');
        });

        it('TC1b: should update existing device token devtype', async () => {
            prisma.device.findUnique.mockResolvedValue(mockDevice);
            prisma.device.update.mockResolvedValue({ ...mockDevice, devtype: 2 });

            const result = await service.setDevtoken(mockUser, 2, 'token-abc');

            expect(prisma.device.update).toHaveBeenCalledWith({
                where: { id: mockDevice.id },
                data: { devtype: 2 },
            });
            expect(result.devtype).toBe('2');
        });

        it('TC5: should handle devtype 0 (Android)', async () => {
            prisma.device.findUnique.mockResolvedValue(null);
            const androidDevice = { ...mockDevice, devtype: 0 };
            prisma.device.create.mockResolvedValue(androidDevice);

            const result = await service.setDevtoken(mockUser, 0, 'token-abc');

            expect(result.devtype).toBe('0');
        });

        it('should return devToken as string', async () => {
            prisma.device.findUnique.mockResolvedValue(null);
            prisma.device.create.mockResolvedValue(mockDevice);

            const result = await service.setDevtoken(mockUser, 1, 'token-abc');

            expect(typeof result.devToken).toBe('string');
            expect(typeof result.devtype).toBe('string');
        });

        it('should handle different devToken for same user', async () => {
            prisma.device.findUnique.mockResolvedValue(null);
            const newDevice = { ...mockDevice, id: 'dev-2', devToken: 'token-xyz' };
            prisma.device.create.mockResolvedValue(newDevice);

            const result = await service.setDevtoken(mockUser, 1, 'token-xyz');

            expect(result.devToken).toBe('token-xyz');
        });
    });
});
