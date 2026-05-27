import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import 'multer';
import { AuthService } from './auth.service.ts';
import { MediaService } from '../posts/media.service.ts';
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
    constructor(
        private readonly authService: AuthService,
        private readonly mediaService: MediaService,
    ) {}

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
    @UseInterceptors(FileFieldsInterceptor([{ name: 'avatar', maxCount: 1 }]))
    async changeInfoAfterSignup(
        @Body() dto: ChangeInfoAfterSignupDto,
        @UploadedFiles() files: { avatar?: Express.Multer.File[] },
    ) {
        let avatarUrl: string | undefined = dto.avatar;
        if (files?.avatar?.[0]) {
            avatarUrl = await this.mediaService.uploadImage(files.avatar[0]);
        }
        const result = await this.authService.changeInfoAfterSignup(dto, avatarUrl);
        return ApiResponse.success(result);
    }
}
