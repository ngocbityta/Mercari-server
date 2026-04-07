import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller.ts';
import { SettingsService } from './settings.service.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
    imports: [PrismaModule],
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService],
})
export class SettingsModule {}
