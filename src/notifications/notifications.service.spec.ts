import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.ts';
import { Notification } from '../entities/notification.entity.ts';
import { User } from '../entities/user.entity.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';
import { EventsGateway } from '../events/events.gateway.ts';

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

const mockNotification = {
    id: 'notif-id-1',
    user_id: 'user-id-123',
    type: '1',
    object_id: 'post-id-1',
    title: 'New content',
    avatar: 'url-to-avatar',
    group_type: 0,
    is_read: false,
    created_at: new Date('2026-01-01'),
};

const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
});

describe('NotificationsService', () => {
    let service: NotificationsService;
    let repository: Partial<Record<keyof Repository<Notification>, jest.Mock>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationsService,
                {
                    provide: getRepositoryToken(Notification),
                    useFactory: mockRepository,
                },
                {
                    provide: EventsGateway,
                    useValue: {
                        sendNewMessage: jest.fn(),
                        sendPushNotification: jest.fn(),
                        sendToUser: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<NotificationsService>(NotificationsService);
        repository = module.get(getRepositoryToken(Notification));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getNotifications', () => {
        it('should return paginated notifications and badge count', async () => {
            repository.find!.mockResolvedValue([mockNotification]);
            repository.count!.mockResolvedValue(5);

            const result = await service.getNotifications(mockUser, 0, 10);

            expect(repository.find).toHaveBeenCalledWith({
                where: { user_id: mockUser.id },
                order: { created_at: 'DESC' },
                skip: 0,
                take: 10,
            });
            expect(repository.count).toHaveBeenCalledWith({
                where: { user_id: mockUser.id, is_read: false },
            });
            expect(result.data).toHaveLength(1);
            expect(result.badge).toBe('5');
            expect(result.data[0].notification_id).toBe('notif-id-1');
            expect(result.data[0].read).toBe('0');
        });
    });

    describe('setReadNotification', () => {
        it('should mark a notification as read and return updated badge', async () => {
            const notifCopy = { ...mockNotification, is_read: false };
            repository.findOne!.mockResolvedValue(notifCopy);
            repository.save!.mockResolvedValue({ ...notifCopy, is_read: true });
            repository.count!.mockResolvedValue(4); // Decreased by 1

            const result = await service.setReadNotification(mockUser, 'notif-id-1');

            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: 'notif-id-1', user_id: mockUser.id },
            });
            expect(notifCopy.is_read).toBe(true);
            expect(repository.save).toHaveBeenCalledWith(notifCopy);
            expect(result.badge).toBe('4');
        });

        it('should throw NotFoundException if notification is not found', async () => {
            repository.findOne!.mockResolvedValue(null);

            await expect(service.setReadNotification(mockUser, 'invalid-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
