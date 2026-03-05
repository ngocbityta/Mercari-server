import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity.ts';
import { User } from '../entities/user.entity.ts';

@Injectable()
export class DevicesService {
    constructor(
        @InjectRepository(Device)
        private readonly devicesRepository: Repository<Device>,
    ) {}

    async setDevtoken(user: User, devtype: number, devtoken: string) {
        const existingDevice = await this.devicesRepository.findOne({
            where: { user_id: user.id, dev_token: devtoken },
        });

        if (existingDevice) {
            existingDevice.devtype = devtype;
            await this.devicesRepository.save(existingDevice);
            return { devtype: String(existingDevice.devtype), dev_token: existingDevice.dev_token };
        }

        const device = this.devicesRepository.create({
            user_id: user.id,
            devtype: devtype,
            dev_token: devtoken,
        });

        const savedDevice = await this.devicesRepository.save(device);
        return { devtype: String(savedDevice.devtype), dev_token: savedDevice.dev_token };
    }
}
