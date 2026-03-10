import { IsNotEmpty, IsString, IsNumberString } from 'class-validator';

export class GetNotificationDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsNumberString()
    @IsNotEmpty()
    index: string;

    @IsNumberString()
    @IsNotEmpty()
    count: string;
}

export class SetReadNotificationDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    notificationId: string;
}
