import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config.ts';
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
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: getDatabaseConfig,
        }),
        EventsModule,
        UsersModule,
        NotificationsModule,
        DevicesModule,
        ConversationsModule,
    ],
})
export class AppModule {}
