import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../common/enums/user.enum.ts';

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
    cover_image?: string;

    @IsString()
    @IsOptional()
    description?: string;
}
