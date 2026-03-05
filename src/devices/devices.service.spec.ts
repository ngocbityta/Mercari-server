import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DevicesService } from './devices.service.ts';
import { Device } from '../entities/device.entity.ts';
import { User } from '../entities/user.entity.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';

const mockUser: User = {
    id: 'user-id-123',
    phonenumber: '0123456789',
    password: 'hash',
    username: 'testu',
    avatar: null,
    cover_image: null,
    description: null,
    role: UserRole.HV,
    token: 'token123',
    status: UserStatus.ACTIVE,
    online: false,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
};

const mockRepository = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
});

describe('DevicesService', () => {
    let service: DevicesService;
    let repository: Partial<Record<keyof Repository<Device>, jest.Mock>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DevicesService,
                {
                    provide: getRepositoryToken(Device),
                    useFactory: mockRepository,
                },
            ],
        }).compile();

        service = module.get<DevicesService>(DevicesService);
        repository = module.get(getRepositoryToken(Device));
    });

    describe('setDevtoken', () => {
        it('should create new device token if it does not exist', async () => {
            repository.findOne!.mockResolvedValue(null);

            const newDevice = { user_id: mockUser.id, devtype: 1, dev_token: 'token-abc' };
            repository.create!.mockReturnValue(newDevice);
            repository.save!.mockResolvedValue(newDevice);

            const result = await service.setDevtoken(mockUser, 1, 'token-abc');

            expect(repository.findOne).toHaveBeenCalledWith({
                where: { user_id: mockUser.id, dev_token: 'token-abc' },
            });
            expect(repository.create).toHaveBeenCalledWith({
                user_id: mockUser.id,
                devtype: 1,
                dev_token: 'token-abc',
            });
            expect(result.devtype).toBe('1');
            expect(result.dev_token).toBe('token-abc');
        });

        it('should update existing device token devtype', async () => {
            const existingDevice = { user_id: mockUser.id, devtype: 0, dev_token: 'token-abc' };
            repository.findOne!.mockResolvedValue(existingDevice);
            repository.save!.mockResolvedValue({ ...existingDevice, devtype: 1 });

            const result = await service.setDevtoken(mockUser, 1, 'token-abc');

            expect(existingDevice.devtype).toBe(1);
            expect(repository.save).toHaveBeenCalledWith(existingDevice);
            expect(repository.create).not.toHaveBeenCalled();
            expect(result.devtype).toBe('1');
        });
    });
});
