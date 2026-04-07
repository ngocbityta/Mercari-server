import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GetPushSettingsDto {
    @IsString()
    @IsNotEmpty()
    token: string;
}

export class SetPushSettingsDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    likeComment?: string;

    @IsString()
    @IsOptional()
    fromFriends?: string;

    @IsString()
    @IsOptional()
    requestedFriend?: string;

    @IsString()
    @IsOptional()
    suggestedFriend?: string;

    @IsString()
    @IsOptional()
    birthday?: string;

    @IsString()
    @IsOptional()
    video?: string;

    @IsString()
    @IsOptional()
    report?: string;

    @IsString()
    @IsOptional()
    soundOn?: string;

    @IsString()
    @IsOptional()
    notificationOn?: string;

    @IsString()
    @IsOptional()
    vibrantOn?: string;

    @IsString()
    @IsOptional()
    ledOn?: string;
}
