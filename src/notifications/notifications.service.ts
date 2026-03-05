import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity.ts';
import { User } from '../entities/user.entity.ts';
import { EventsGateway } from '../events/events.gateway.ts';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private readonly notificationsRepository: Repository<Notification>,
        private readonly eventsGateway: EventsGateway,
    ) {}

    async getNotifications(user: User, index: number, count: number) {
        const notifications = await this.notificationsRepository.find({
            where: { user_id: user.id },
            order: { created_at: 'DESC' },
            skip: index,
            take: count,
        });

        const badge = await this.notificationsRepository.count({
            where: { user_id: user.id, is_read: false },
        });

        const lastUpdate = new Date().toISOString();

        return {
            data: notifications.map((n) => ({
                type: n.type ?? '',
                object_id: n.object_id ?? '0',
                title: n.title ?? '',
                notification_id: n.id,
                created: n.created_at.toISOString(),
                avatar: n.avatar ?? '',
                group: n.group_type,
                read: n.is_read ? '1' : '0',
            })),
            badge: String(badge),
            last_update: lastUpdate,
        };
    }

    async setReadNotification(user: User, notificationId: string) {
        const notification = await this.notificationsRepository.findOne({
            where: { id: notificationId, user_id: user.id },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        notification.is_read = true;
        await this.notificationsRepository.save(notification);

        const badge = await this.notificationsRepository.count({
            where: { user_id: user.id, is_read: false },
        });

        return {
            badge: String(badge),
            last_update: new Date().toISOString(),
        };
    }
}
