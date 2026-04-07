import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../../src/notifications/notifications.controller.ts';
import { NotificationsService } from '../../src/notifications/notifications.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { NotFoundException } from '@nestjs/common';
import { TokenGuard } from '../../src/common/guards/token.guard.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { User, UserRole, UserStatus } from '@prisma/client';

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
                    provide: PrismaService, // TokenGuard needs this
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

    describe('setReadNotification', () => {
        it('should return 9994 when service throws Notification not found', async () => {
            service.setReadNotification.mockRejectedValue(
                new NotFoundException('Notification not found'),
            );

            const result = await controller.setReadNotification(
                { token: 'tok', notificationId: '123' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.NO_DATA);
            expect(result.code).toBe('9994');
        });

        it('should return 9999 for generic errors', async () => {
            service.setReadNotification.mockRejectedValue(new Error('Internal error'));

            const result = await controller.setReadNotification(
                { token: 'tok', notificationId: '123' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.EXCEPTION_ERROR);
            expect(result.code).toBe('9999');
        });
    });
});
