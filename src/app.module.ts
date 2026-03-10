import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.ts';
import { UsersModule } from './users/users.module.ts';
import { NotificationsModule } from './notifications/notifications.module.ts';
import { DevicesModule } from './devices/devices.module.ts';
import { ConversationsModule } from './conversations/conversations.module.ts';
import { EventsModule } from './events/events.module.ts';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        PrismaModule,
        EventsModule,
        UsersModule,
        NotificationsModule,
        DevicesModule,
        ConversationsModule,
    ],
})
export class AppModule {}
