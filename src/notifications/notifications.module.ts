import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller.ts';
import { NotificationsService } from './notifications.service.ts';
import { Notification } from '../entities/notification.entity.ts';
import { User } from '../entities/user.entity.ts';

@Module({
    imports: [TypeOrmModule.forFeature([Notification, User])],
    controllers: [NotificationsController],
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule {}
