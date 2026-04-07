import { User } from '@prisma/client';

export interface IPushSettingsQuery {
    getPushSettings(user: User): Promise<any>;
}

export interface IPushSettingsCommand {
    setPushSettings(user: User, data: Record<string, string | undefined>): Promise<any>;
}
