import { User } from '@prisma/client';

export interface INotificationQuery {
    getNotifications(
        user: User,
        index: number,
        count: number,
        targetUserId?: string,
        group?: number,
    ): Promise<any>;
}

export interface INotificationCommand {
    setReadNotification(user: User, notificationId: string): Promise<any>;
}
