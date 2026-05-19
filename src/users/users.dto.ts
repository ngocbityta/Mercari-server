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
    height?: string;

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
    @IsOptional()
    token?: string;

    @IsString()
    @IsOptional()
    username?: string;
}

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty({ message: 'Máº­t kháº©u cÅ© khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    @MinLength(6, { message: 'Máº­t kháº©u cÅ© quÃ¡ ngáº¯n' })
    @MaxLength(10, { message: 'Máº­t kháº©u cÅ© quÃ¡ dÃ i' })
    @Matches(/^[a-zA-Z0-9]+$/, {
        message: 'Máº­t kháº©u cÅ© khÃ´ng Ä‘Æ°á»£c chá»©a kÃ½ tá»± Ä‘áº·c biá»‡t',
    })
    password: string;

    @IsString()
    @IsNotEmpty({ message: 'Máº­t kháº©u má»›i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    @MinLength(6, { message: 'Máº­t kháº©u má»›i quÃ¡ ngáº¯n' })
    @MaxLength(10, { message: 'Máº­t kháº©u má»›i quÃ¡ dÃ i' })
    @Matches(/^[a-zA-Z0-9]+$/, {
        message: 'Máº­t kháº©u má»›i khÃ´ng Ä‘Æ°á»£c chá»©a kÃ½ tá»± Ä‘áº·c biá»‡t',
    })
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
