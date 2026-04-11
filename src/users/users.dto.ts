import {
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength,
    MaxLength,
    Matches,
} from 'class-validator';
import { UserRole, UserStatus } from '../enums/users.enum.ts';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    phonenumber: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @IsEnum(UserRole)
    @IsNotEmpty()
    role: UserRole;

    @IsString()
    @IsOptional()
    username?: string;

    @IsString()
    @IsOptional()
    avatar?: string;

    @IsString()
    @IsOptional()
    coverImage?: string;

    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateUserDto {
    @IsString()
    @IsOptional()
    phonenumber?: string;

    @IsString()
    @IsOptional()
    @MinLength(6)
    password?: string;

    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;

    @IsString()
    @IsOptional()
    username?: string;

    @IsString()
    @IsOptional()
    avatar?: string;

    @IsString()
    @IsOptional()
    coverImage?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(UserStatus)
    @IsOptional()
    status?: UserStatus;

    @IsBoolean()
    @IsOptional()
    online?: boolean;
}

export class GetUserInfoDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    userId?: string;
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
    coverImage?: string;

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
    @IsNotEmpty({ message: 'Mật khẩu cũ không được để trống' })
    @MinLength(6, { message: 'Mật khẩu cũ quá ngắn' })
    @MaxLength(10, { message: 'Mật khẩu cũ quá dài' })
    @Matches(/^[a-zA-Z0-9]+$/, { message: 'Mật khẩu cũ không được chứa ký tự đặc biệt' })
    password: string;

    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
    @MinLength(6, { message: 'Mật khẩu mới quá ngắn' })
    @MaxLength(10, { message: 'Mật khẩu mới quá dài' })
    @Matches(/^[a-zA-Z0-9]+$/, { message: 'Mật khẩu mới không được chứa ký tự đặc biệt' })
    newPassword: string;
}

export class SetBlockDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    userId: string;

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
    lastUpdate: string;

    @IsString()
    @IsOptional()
    userId?: string;
}
export class GetListBlocksDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    index?: string;

    @IsString()
    @IsOptional()
    count?: string;

    @IsString()
    @IsOptional()
    user_id?: string;
}
