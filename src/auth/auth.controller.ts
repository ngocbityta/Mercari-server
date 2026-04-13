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
import { ApiResponse } from '../common/dto/api-response.dto.ts';

@Controller()
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('signup')
    @HttpCode(HttpStatus.OK)
    async signup(@Body() dto: SignupDto) {
        const result = await this.authService.signup(dto);
        return ApiResponse.success(result);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto) {
        const result = await this.authService.login(dto);
        return ApiResponse.success(result);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@Body() dto: LogoutDto) {
        const result = await this.authService.logout(dto.token);
        return ApiResponse.success(result);
    }

    @Post('get_verify_code')
    @HttpCode(HttpStatus.OK)
    async getVerifyCode(@Body() dto: GetVerifyCodeDto) {
        const result = await this.authService.getVerifyCode(dto.phonenumber);
        return ApiResponse.success(result);
    }

    @Post('check_verify_code')
    @HttpCode(HttpStatus.OK)
    async checkVerifyCode(@Body() dto: CheckVerifyCodeDto) {
        const result = await this.authService.checkVerifyCode(dto);
        return ApiResponse.success(result);
    }

    @Post('change_info_after_signup')
    @HttpCode(HttpStatus.OK)
    async changeInfoAfterSignup(@Body() dto: ChangeInfoAfterSignupDto) {
        const result = await this.authService.changeInfoAfterSignup(dto);
        return ApiResponse.success(result);
    }
}
