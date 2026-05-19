import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { UserRole } from '../enums/users.enum.ts';

export class SignupDto {
    @IsString()
    @IsNotEmpty({ message: 'Sá»‘ Ä‘iá»‡n thoáº¡i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    @Matches(/^0\d{9}$/, {
        message: 'Sá»‘ Ä‘iá»‡n thoáº¡i pháº£i Ä‘á»§ 10 sá»‘ vÃ  báº¯t Ä‘áº§u báº±ng 0',
    })
    phonenumber: string;

    @IsString()
    @IsNotEmpty({ message: 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    @MinLength(6, { message: 'Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±' })
    @MaxLength(10, { message: 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c quÃ¡ 10 kÃ½ tá»±' })
    @Matches(/^[a-zA-Z0-9]+$/, {
        message: 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c chá»©a kÃ½ tá»± Ä‘áº·c biá»‡t',
    })
    password: string;

    @IsEnum(UserRole, { message: 'Loáº¡i tÃ i khoáº£n pháº£i lÃ  HV hoáº·c GV' })
    @IsNotEmpty({ message: 'Loáº¡i tÃ i khoáº£n khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    role: UserRole;

    @IsString()
    @IsNotEmpty({ message: 'UUID thiáº¿t bá»‹ khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    uuid: string;
}

export class LoginDto {
    @IsString()
    @IsNotEmpty({ message: 'Sá»‘ Ä‘iá»‡n thoáº¡i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    @Matches(/^0\d{9}$/, {
        message: 'Sá»‘ Ä‘iá»‡n thoáº¡i pháº£i Ä‘á»§ 10 sá»‘ vÃ  báº¯t Ä‘áº§u báº±ng 0',
    })
    phonenumber: string;

    @IsString()
    @IsNotEmpty({ message: 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    @MinLength(6, { message: 'Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±' })
    @MaxLength(10, { message: 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c quÃ¡ 10 kÃ½ tá»±' })
    @Matches(/^[a-zA-Z0-9]+$/, {
        message: 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c chá»©a kÃ½ tá»± Ä‘áº·c biá»‡t',
    })
    password: string;

    @IsString()
    @IsNotEmpty({ message: 'Device token khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    devtoken: string;
}

export class LogoutDto {
    @IsString()
    @IsNotEmpty({ message: 'Token khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    token: string;
}

export class GetVerifyCodeDto {
    @IsString()
    @IsNotEmpty({ message: 'Sá»‘ Ä‘iá»‡n thoáº¡i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    @Matches(/^0\d{9}$/, {
        message: 'Sá»‘ Ä‘iá»‡n thoáº¡i pháº£i Ä‘á»§ 10 sá»‘ vÃ  báº¯t Ä‘áº§u báº±ng 0',
    })
    phonenumber: string;
}

export class CheckVerifyCodeDto {
    @IsString()
    @IsNotEmpty({ message: 'Sá»‘ Ä‘iá»‡n thoáº¡i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    @Matches(/^0\d{9}$/, {
        message: 'Sá»‘ Ä‘iá»‡n thoáº¡i pháº£i Ä‘á»§ 10 sá»‘ vÃ  báº¯t Ä‘áº§u báº±ng 0',
    })
    phonenumber: string;

    @IsString()
    @IsNotEmpty({ message: 'MÃ£ xÃ¡c thá»±c khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng' })
    codeVerify: string;
}

export class ChangeInfoAfterSignupDto {
    @IsString()
    @IsOptional()
    @MinLength(36, { message: 'Token khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng (quÃ¡ ngáº¯n)' })
    token?: string;

    @IsString()
    @IsOptional()
    @MinLength(3, { message: 'Username quÃ¡ ngáº¯n' })
    @MaxLength(50, { message: 'Username quÃ¡ dÃ i' })
    @Matches(/^[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF ]+$/, {
        message: 'Username khÃ´ng Ä‘Æ°á»£c chá»©a kÃ½ tá»± Ä‘áº·c biá»‡t',
    })
    username?: string;

    @IsString()
    @IsOptional()
    height?: string;
}
