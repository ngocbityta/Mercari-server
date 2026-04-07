import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
    height: null,
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

const mockReadNotification: Notification = {
    ...mockNotification,
    id: 'notif-2',
    isRead: true,
    title: 'Old message',
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
        it('TC1: should return list of notifications with badge and last_update', async () => {
            prisma.notification.findMany.mockResolvedValue([mockNotification]);
            prisma.notification.count.mockResolvedValue(1);

            const result = await service.getNotifications(mockUser, 0, 10);

            expect(result.data).toHaveLength(1);
            expect(result.badge).toBe('1');
            expect(result.last_update).toBeDefined();
            expect(result.data[0]).toEqual({
                type: 'new_message',
                object_id: 'obj-1',
                title: 'New message',
                notificationId: 'notif-1',
                created: mockNotification.createdAt.toISOString(),
                avatar: 'avatar-url',
                group: 1,
                read: '0',
            });
        });

        it('should return empty array when no notifications exist', async () => {
            prisma.notification.findMany.mockResolvedValue([]);
            prisma.notification.count.mockResolvedValue(0);

            const result = await service.getNotifications(mockUser, 0, 10);

            expect(result.data).toHaveLength(0);
            expect(result.badge).toBe('0');
        });

        it('should handle pagination correctly', async () => {
            prisma.notification.findMany.mockResolvedValue([mockNotification]);
            prisma.notification.count.mockResolvedValue(5);

            const result = await service.getNotifications(mockUser, 2, 1);

            expect(prisma.notification.findMany).toHaveBeenCalledWith({
                where: { userId: mockUser.id },
                orderBy: { createdAt: 'desc' },
                skip: 2,
                take: 1,
            });
            expect(result.badge).toBe('5');
        });

        it('should handle notifications with null fields gracefully', async () => {
            const nullFieldNotif: Notification = {
                ...mockNotification,
                type: null,
                objectId: null,
                title: null,
                avatar: null,
            };
            prisma.notification.findMany.mockResolvedValue([nullFieldNotif]);
            prisma.notification.count.mockResolvedValue(1);

            const result = await service.getNotifications(mockUser, 0, 10);

            expect(result.data[0].type).toBe('');
            expect(result.data[0].object_id).toBe('0');
            expect(result.data[0].title).toBe('');
            expect(result.data[0].avatar).toBe('');
        });

        it('should return read status as string 0 or 1', async () => {
            prisma.notification.findMany.mockResolvedValue([
                mockNotification,
                mockReadNotification,
            ]);
            prisma.notification.count.mockResolvedValue(1);

            const result = await service.getNotifications(mockUser, 0, 10);

            expect(result.data[0].read).toBe('0');
            expect(result.data[1].read).toBe('1');
        });
    });

    describe('setReadNotification', () => {
        it('TC1: should mark notification as read and return updated badge', async () => {
            prisma.notification.findUnique.mockResolvedValue(mockNotification);
            prisma.notification.update.mockResolvedValue({
                ...mockNotification,
                isRead: true,
            });
            prisma.notification.count.mockResolvedValue(0);

            const result = await service.setReadNotification(mockUser, 'notif-1');

            expect(prisma.notification.update).toHaveBeenCalledWith({
                where: { id: 'notif-1' },
                data: { isRead: true },
            });
            expect(result.badge).toBe('0');
            expect(result.last_update).toBeDefined();
        });

        it('TC7: should still mark as read even if already read', async () => {
            prisma.notification.findUnique.mockResolvedValue(mockReadNotification);
            prisma.notification.update.mockResolvedValue(mockReadNotification);
            prisma.notification.count.mockResolvedValue(0);

            const result = await service.setReadNotification(mockUser, 'notif-2');

            expect(prisma.notification.update).toHaveBeenCalled();
            expect(result.badge).toBe('0');
        });

        it('should throw NotFoundException when notification does not exist', async () => {
            prisma.notification.findUnique.mockResolvedValue(null);

            await expect(service.setReadNotification(mockUser, 'nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw NotFoundException when notification belongs to another user', async () => {
            const otherUserNotif = { ...mockNotification, userId: 'other-user' };
            prisma.notification.findUnique.mockResolvedValue(otherUserNotif);

            await expect(service.setReadNotification(mockUser, 'notif-1')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should return remaining unread badge count', async () => {
            prisma.notification.findUnique.mockResolvedValue(mockNotification);
            prisma.notification.update.mockResolvedValue({
                ...mockNotification,
                isRead: true,
            });
            prisma.notification.count.mockResolvedValue(3);

            const result = await service.setReadNotification(mockUser, 'notif-1');

            expect(result.badge).toBe('3');
        });
    });
});
