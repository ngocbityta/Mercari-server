import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../../src/notifications/notifications.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { EventsGateway } from '../../src/events/events.gateway.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { User, Notification } from '@prisma/client';

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

const mockNotification: Notification = {
    id: 'notif-1',
    userId: mockUser.id,
    type: 'new_message',
    objectId: 'obj-1',
    title: 'New message',
    avatar: 'avatar-url',
    groupType: 1,
    isRead: false,
    createdAt: new Date('2026-01-01'),
};

const mockPrisma = {
    notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
    },
};

describe('NotificationsService', () => {
    let service: NotificationsService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationsService,
                { provide: PrismaService, useValue: mockPrisma },
                {
                    provide: EventsGateway,
                    useValue: {
                        sendPushNotification: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<NotificationsService>(NotificationsService);
        prisma = module.get(PrismaService);
    });

    describe('getNotifications', () => {
        it('should return list of notifications', async () => {
            prisma.notification.findMany.mockResolvedValue([mockNotification]);
            prisma.notification.count.mockResolvedValue(1);

            const result = await service.getNotifications(mockUser, 0, 10);

            expect(result.data).toHaveLength(1);
            expect(result.badge).toBe('1');
        });
    });

    describe('setReadNotification', () => {
        it('should mark notification as read', async () => {
            prisma.notification.findUnique.mockResolvedValue(mockNotification);
            prisma.notification.update.mockResolvedValue({ ...mockNotification, isRead: true });
            prisma.notification.count.mockResolvedValue(0);

            const result = await service.setReadNotification(mockUser, 'notif-1');

            expect(prisma.notification.update).toHaveBeenCalled();
            expect(result.badge).toBe('0');
        });
    });
});
