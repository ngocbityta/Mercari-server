import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User, Prisma } from '@prisma/client';
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

    async getNotifications(
        user: User,
        index: number,
        count: number,
        targetUserId?: string,
        group?: number,
    ) {
        let targetUser = user;
        if (targetUserId) {
            if (user.role !== 'GV') {
                throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
            }
            const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
            if (!target) {
                throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
            }
            targetUser = target;
        }

        const whereClause: Prisma.NotificationWhereInput = { userId: targetUser.id };
        if (group !== undefined) {
            if (group === 0) {
                whereClause.groupType = { in: [0, 1, 2] };
            } else if (group === 1) {
                whereClause.groupType = { not: 0 };
            }
        }

        const notifications = await this.prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            skip: index,
            take: count,
            include: { actor: true },
        });

        const badge = await this.prisma.notification.count({
            where: { userId: targetUser.id, isRead: false },
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
                    // Requirement 8: Default values for type, avatar, group, read, objectId
                    type: n.type ?? 'home',
                    objectId: n.objectId ?? '0',
                    title: n.title,
                    notificationId: n.id,
                    created: n.createdAt.toISOString(),
                    avatar: n.actor?.avatar ?? n.avatar ?? 'app_icon',
                    group: n.groupType === 0 ? '0' : '1',
                    read: n.isRead ? '1' : '0',
                })),
            // Requirement 9: Ensure badge is at least 0
            badge: String(badge >= 0 ? badge : 0),
            lastUpdate: lastUpdate,
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
            lastUpdate: new Date().toISOString(),
        };
    }
}
