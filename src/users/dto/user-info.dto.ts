import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GetUserInfoDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    user_id?: string;
}

export class SetUserInfoDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    username?: string;

    @IsString()
    @IsOptional()
    avatar?: string;

    @IsString()
    @IsOptional()
    cover_image?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    link?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    country?: string;
}

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsString()
    @IsNotEmpty()
    new_password: string;
}

export class SetBlockDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    user_id: string;

    @IsString()
    @IsNotEmpty()
    type: string;
}

export class CheckNewVersionDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    last_update: string;

    @IsString()
    @IsOptional()
    user_id?: string;
}
