import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway.ts';
import { INotificationQuery, INotificationCommand } from './notifications.interfaces.ts';
import { ApiException } from '../common/exceptions/api.exception.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

@Injectable()
export class NotificationsService implements INotificationQuery, INotificationCommand {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsGateway: EventsGateway,
    ) {}

    async getNotifications(user: User, index: number, count: number) {
        const notifications = await this.prisma.notification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            skip: index,
            take: count,
        });

        const badge = await this.prisma.notification.count({
            where: { userId: user.id, isRead: false },
        });

        const lastUpdate = new Date().toISOString();

        return {
            data: notifications
                .filter((n) => {
                    // Requirement 6: Ignore notifications without title
                    if (!n.title || n.title.trim() === '') {
                        return false;
                    }

                    // Requirement 7: Remove notifications with errors in notification_id, created
                    // Note: In Prisma, id and createdAt are required, but we check just in case.
                    if (!n.id || !n.createdAt) {
                        return false;
                    }

                    return true;
                })
                .map((n) => ({
                    // Requirement 8: Default values for type, avatar, group, read, object_id
                    type: n.type ?? 'home',
                    object_id: n.objectId ?? '0',
                    title: n.title,
                    notificationId: n.id,
                    created: n.createdAt.toISOString(),
                    avatar: n.avatar ?? 'app_icon',
                    group: n.groupType ?? 0,
                    read: n.isRead ? '1' : '0',
                })),
            // Requirement 9: Ensure badge is at least 0
            badge: String(badge >= 0 ? badge : 0),
            last_update: lastUpdate,
        };
    }

    async setReadNotification(user: User, notificationId: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification || notification.userId !== user.id) {
            throw new ApiException(ResponseCode.NO_DATA, 'Notification not found');
        }

        await this.prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });

        const badge = await this.prisma.notification.count({
            where: { userId: user.id, isRead: false },
        });

        return {
            badge: String(badge >= 0 ? badge : 0),
            last_update: new Date().toISOString(),
        };
    }
}
