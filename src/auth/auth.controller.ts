import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.ts';
import {
    SignupDto,
    LoginDto,
    LogoutDto,
    GetVerifyCodeDto,
    CheckVerifyCodeDto,
    ChangeInfoAfterSignupDto,
} from './auth.dto.ts';

@Controller()
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
    changeInfoAfterSignup(@Body() dto: ChangeInfoAfterSignupDto) {
        return this.authService.changeInfoAfterSignup(dto);
    }
}
