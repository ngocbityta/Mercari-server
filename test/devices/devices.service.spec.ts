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
        it('should create new device token if it does not exist', async () => {
            prisma.device.findUnique.mockResolvedValue(null);
            prisma.device.create.mockResolvedValue(mockDevice);

            const result = await service.setDevtoken(mockUser, 1, 'token-abc');

            expect(prisma.device.findUnique).toHaveBeenCalled();
            expect(prisma.device.create).toHaveBeenCalled();
            expect(result.devToken).toBe('token-abc');
        });

        it('should update existing device token devtype', async () => {
            prisma.device.findUnique.mockResolvedValue(mockDevice);
            prisma.device.update.mockResolvedValue({ ...mockDevice, devtype: 2 });

            const result = await service.setDevtoken(mockUser, 2, 'token-abc');

            expect(prisma.device.update).toHaveBeenCalled();
            expect(result.devtype).toBe('2');
        });
    });
});
