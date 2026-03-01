import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole, UserStatus } from '../../common/enums/user.enum.ts';

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
    cover_image?: string;

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
