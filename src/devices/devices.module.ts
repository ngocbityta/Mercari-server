import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesController } from './devices.controller.ts';
import { DevicesService } from './devices.service.ts';
import { Device } from '../entities/device.entity.ts';
import { User } from '../entities/user.entity.ts';

@Module({
    imports: [TypeOrmModule.forFeature([Device, User])],
    controllers: [DevicesController],
    providers: [DevicesService],
    exports: [DevicesService],
})
export class DevicesModule {}
