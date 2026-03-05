import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from './devices.controller.ts';
import { DevicesService } from './devices.service.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';
import { User } from '../entities/user.entity.ts';
import { ResponseCode } from '../common/enums/response-code.enum.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';

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
    created_at: new Date(),
    updated_at: new Date(),
};

const mockDevicesService = {
    setDevtoken: jest.fn(),
};

describe('DevicesController', () => {
    let controller: DevicesController;
    let service: typeof mockDevicesService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DevicesController],
            providers: [
                {
                    provide: DevicesService,
                    useValue: mockDevicesService,
                },
            ],
        })
            .overrideGuard(TokenGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<DevicesController>(DevicesController);
        service = module.get(DevicesService);
    });

    describe('setDevtoken', () => {
        it('should return success and data', async () => {
            const serviceData = { devtype: '1', dev_token: 'abc' };
            service.setDevtoken.mockResolvedValue(serviceData);

            const result = await controller.setDevtoken(
                { token: 'tok', devtype: '1', devtoken: 'abc' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual(serviceData);
            expect(service.setDevtoken).toHaveBeenCalledWith(mockUser, 1, 'abc');
        });

        it('should return error if devtype is invalid', async () => {
            const result = await controller.setDevtoken(
                { token: 'tok', devtype: 'invalid', devtoken: 'abc' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect(service.setDevtoken).not.toHaveBeenCalled();
        });

        it('should return error if devtoken is empty', async () => {
            const result = await controller.setDevtoken(
                { token: 'tok', devtype: '1', devtoken: '   ' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect(service.setDevtoken).not.toHaveBeenCalled();
        });

        it('should handle service exceptions', async () => {
            service.setDevtoken.mockRejectedValue(new Error());

            const result = await controller.setDevtoken(
                { token: 'tok', devtype: '1', devtoken: 'abc' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.EXCEPTION_ERROR);
        });
    });
});
