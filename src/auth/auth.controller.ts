import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
    Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthService } from './auth.service.ts';
import {
    SignupDto,
    LoginDto,
    LogoutDto,
    GetVerifyCodeDto,
    CheckVerifyCodeDto,
    ChangeInfoAfterSignupDto,
} from './auth.dto.ts';
import {
    PROFILE_AVATAR_UPLOAD_OPTIONS,
    type UploadedMultipartFile,
} from '../common/uploads/profile-upload.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

@Controller('it4788')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('signup')
    @HttpCode(HttpStatus.OK)
    signup(@Body() dto: SignupDto) {
        return this.authService.signup(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    logout(@Body() dto: LogoutDto) {
        return this.authService.logout(dto.token);
    }

    @Post('get_verify_code')
    @HttpCode(HttpStatus.OK)
    getVerifyCode(@Body() dto: GetVerifyCodeDto) {
        return this.authService.getVerifyCode(dto.phonenumber);
    }

    @Post('check_verify_code')
    @HttpCode(HttpStatus.OK)
    checkVerifyCode(@Body() dto: CheckVerifyCodeDto) {
        return this.authService.checkVerifyCode(dto);
    }

    @Post('change_info_after_signup')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('avatar', PROFILE_AVATAR_UPLOAD_OPTIONS))
    changeInfoAfterSignup(
        @Req() request: Request,
        @Body() dto: ChangeInfoAfterSignupDto,
        @UploadedFile() avatarFile?: UploadedMultipartFile,
    ) {
        if (!request.is('multipart/form-data')) {
            return {
                code: ResponseCode.INVALID_PARAMETER_TYPE,
                message: 'Content-Type must be multipart/form-data',
            };
        }

        return this.authService.changeInfoAfterSignup(dto, avatarFile);
    }
}
