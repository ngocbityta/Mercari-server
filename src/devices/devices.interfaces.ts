import { User } from '@prisma/client';

export interface IDeviceCommand {
    setDevtoken(user: User, devtype: number, devtoken: string): Promise<any>;
}
