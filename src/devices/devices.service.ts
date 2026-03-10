import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User } from '@prisma/client';

@Injectable()
export class DevicesService {
    constructor(private readonly prisma: PrismaService) {}

    async setDevtoken(user: User, devtype: number, devtoken: string) {
        const existingDevice = await this.prisma.device.findUnique({
            where: {
                userId_devToken: {
                    userId: user.id,
                    devToken: devtoken,
                },
            },
        });

        if (existingDevice) {
            const updatedDevice = await this.prisma.device.update({
                where: { id: existingDevice.id },
                data: { devtype: devtype },
            });
            return { devtype: String(updatedDevice.devtype), devToken: updatedDevice.devToken };
        }

        const savedDevice = await this.prisma.device.create({
            data: {
                userId: user.id,
                devtype: devtype,
                devToken: devtoken,
            },
        });

        return { devtype: String(savedDevice.devtype), devToken: savedDevice.devToken };
    }
}
