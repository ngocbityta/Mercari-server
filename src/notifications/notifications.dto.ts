import { IsNotEmpty, IsString, IsNumberString, IsOptional } from 'class-validator';

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

    @IsString()
    @IsOptional()
    userId?: string;

    @IsNumberString()
    @IsOptional()
    group?: string;
}

export class SetReadNotificationDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    notificationId?: string;
}
