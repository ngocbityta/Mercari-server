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
    @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
    @Matches(/^0\d{9}$/, { message: 'Số điện thoại phải đủ 10 số và bắt đầu bằng 0' })
    phonenumber: string;

    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    @MaxLength(10, { message: 'Mật khẩu không được quá 10 ký tự' })
    @Matches(/^[a-zA-Z0-9]+$/, { message: 'Mật khẩu không được chứa ký tự đặc biệt' })
    password: string;

    @IsEnum(UserRole, { message: 'Loại tài khoản phải là HV hoặc GV' })
    @IsNotEmpty({ message: 'Loại tài khoản không được để trống' })
    role: UserRole;

    @IsString()
    @IsNotEmpty({ message: 'UUID thiết bị không được để trống' })
    uuid: string;
}

export class LoginDto {
    @IsString()
    @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
    @Matches(/^0\d{9}$/, { message: 'Số điện thoại phải đủ 10 số và bắt đầu bằng 0' })
    phonenumber: string;

    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    @MaxLength(10, { message: 'Mật khẩu không được quá 10 ký tự' })
    @Matches(/^[a-zA-Z0-9]+$/, { message: 'Mật khẩu không được chứa ký tự đặc biệt' })
    password: string;

    @IsString()
    @IsNotEmpty({ message: 'Device token không được để trống' })
    devtoken: string;
}

export class LogoutDto {
    @IsString()
    @IsNotEmpty({ message: 'Token không được để trống' })
    token: string;
}

export class GetVerifyCodeDto {
    @IsString()
    @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
    @Matches(/^0\d{9}$/, { message: 'Số điện thoại phải đủ 10 số và bắt đầu bằng 0' })
    phonenumber: string;
}

export class CheckVerifyCodeDto {
    @IsString()
    @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
    @Matches(/^0\d{9}$/, { message: 'Số điện thoại phải đủ 10 số và bắt đầu bằng 0' })
    phonenumber: string;

    @IsString()
    @IsNotEmpty({ message: 'Mã xác thực không được để trống' })
    codeVerify: string;
}

export class ChangeInfoAfterSignupDto {
    @IsString()
    @IsNotEmpty({ message: 'Token không được để trống' })
    @MinLength(36, { message: 'Token không đúng định dạng (quá ngắn)' })
    token: string;

    @IsString()
    @IsNotEmpty({ message: 'Username không được để trống' })
    @MinLength(1, { message: 'Username quá ngắn' })
    @MaxLength(50, { message: 'Username quá dài' })
    @Matches(/^[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF ]+$/, {
        message: 'Username không được chứa ký tự đặc biệt',
    })
    username: string;

    @IsString()
    @IsOptional()
    avatar?: string;

    @IsString()
    @IsOptional()
    height?: string;
}
