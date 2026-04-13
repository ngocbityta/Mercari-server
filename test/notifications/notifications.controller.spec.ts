import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../../src/notifications/notifications.controller.ts';
import { NotificationsService } from '../../src/notifications/notifications.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { TokenGuard } from '../../src/common/guards/token.guard.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { User, UserRole, UserStatus } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';

const mockUser: User = {
    id: 'user-1',
    phonenumber: '0901234567',
    password: 'password123',
    username: 'user1',
    avatar: null,
    coverImage: null,
    description: null,
    role: UserRole.HV,
    token: 'tok',
    height: null,
    status: UserStatus.ACTIVE,
    online: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('NotificationsController', () => {
    let controller: NotificationsController;
    let service: jest.Mocked<NotificationsService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                {
                    provide: NotificationsService,
                    useValue: {
                        getNotifications: jest.fn(),
                        setReadNotification: jest.fn(),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {},
                },
            ],
        })
            .overrideGuard(TokenGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<NotificationsController>(NotificationsController);
        service = module.get(NotificationsService);
    });

    describe('getNotification', () => {
        it('should return wrapped list of notifications', async () => {
            const mockData = { data: [], badge: '0', last_update: '' };
            service.getNotifications.mockResolvedValue(mockData);

            const result = await controller.getNotification({ index: '0', count: '10' }, mockUser);

            expect(result).toEqual({
                code: '1000',
                message: 'OK',
                data: mockData,
            });
        });

        it('should throw ApiException for invalid parameters', async () => {
            await expect(
                controller.getNotification({ index: '-1', count: '10' }, mockUser),
            ).rejects.toThrow(ApiException);
        });
    });

    describe('setReadNotification', () => {
        it('should mark as read and return wrapped result', async () => {
            const mockResult = { badge: '0', last_update: '' };
            service.setReadNotification.mockResolvedValue(mockResult);

            const result = await controller.setReadNotification(
                { token: 'tok', notificationId: 'notif-1' },
                mockUser,
            );

            expect(result).toEqual({
                code: '1000',
                message: 'OK',
                data: mockResult,
            });
        });

        it('should bubble up ApiException from service', async () => {
            const apiException = new ApiException(ResponseCode.NO_DATA, 'Not found');
            service.setReadNotification.mockRejectedValue(apiException);

            await expect(
                controller.setReadNotification({ token: 'tok', notificationId: '123' }, mockUser),
            ).rejects.toThrow(ApiException);
        });
    });
});
