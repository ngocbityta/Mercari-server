import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller.ts';
import { NotificationsService } from './notifications.service.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';
import { User } from '../entities/user.entity.ts';
import { ResponseCode } from '../common/enums/response-code.enum.ts';
import { NotFoundException } from '@nestjs/common';
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
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
};

const mockNotificationsService = {
    getNotifications: jest.fn(),
    setReadNotification: jest.fn(),
};

describe('NotificationsController', () => {
    let controller: NotificationsController;
    let service: typeof mockNotificationsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                {
                    provide: NotificationsService,
                    useValue: mockNotificationsService,
                },
            ],
        })
            .overrideGuard(TokenGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<NotificationsController>(NotificationsController);
        service = module.get(NotificationsService);
    });

    describe('getNotification', () => {
        it('should return success response with paginated data', async () => {
            const serviceData = {
                data: [{ type: '1', read: '0' }],
                badge: '1',
                last_update: 'iso-time',
            };
            service.getNotifications.mockResolvedValue(serviceData);

            const result = await controller.getNotification(
                { token: 'token123', index: '0', count: '10' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual(serviceData);
            expect(service.getNotifications).toHaveBeenCalledWith(mockUser, 0, 10);
        });

        it('should return error if index or count is invalid', async () => {
            const result = await controller.getNotification(
                { token: 'token123', index: 'invalid', count: '10' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect(service.getNotifications).not.toHaveBeenCalled();
        });

        it('should return exception error if service fails', async () => {
            service.getNotifications.mockRejectedValue(new Error('DB Error'));

            const result = await controller.getNotification(
                { token: 'tok', index: '0', count: '10' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.EXCEPTION_ERROR);
        });
    });

    describe('setReadNotification', () => {
        it('should return success when notification is marked read', async () => {
            const serviceData = { badge: '0', last_update: 'iso' };
            service.setReadNotification.mockResolvedValue(serviceData);

            const result = await controller.setReadNotification(
                { token: 'tok', notification_id: 'notif-1' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual(serviceData);
        });

        it('should return exception if notification is not found', async () => {
            service.setReadNotification.mockRejectedValue(new NotFoundException());

            const result = await controller.setReadNotification(
                { token: 'tok', notification_id: 'notif-invalid' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.EXCEPTION_ERROR);
        });
    });
});
