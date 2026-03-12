import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { SignupDto, LoginDto, CheckVerifyCodeDto, ChangeInfoAfterSignupDto } from './auth.dto.ts';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum.ts';
import { UserStatus } from '@prisma/client';
import { TokenService } from './token.service.ts';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tokenService: TokenService,
    ) {}

    /**
     * Signup - Đăng ký tài khoản mới
     */
    async signup(dto: SignupDto) {
        if (dto.password === dto.phonenumber) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: 'Mật khẩu không được trùng với số điện thoại',
            };
        }

        const existingUser = await this.prisma.user.findUnique({
            where: { phonenumber: dto.phonenumber },
        });

        if (existingUser) {
            return {
                code: ResponseCode.USER_EXISTED,
                message: 'User existed',
            };
        }

        await this.prisma.user.create({
            data: {
                phonenumber: dto.phonenumber,
                password: dto.password,
                role: dto.role,
                status: UserStatus.ACTIVE,
            },
        });

        const verifyCode = this.tokenService.generateVerifyCode();

        await this.prisma.verifyCode.deleteMany({
            where: { phonenumber: dto.phonenumber },
        });
        await this.prisma.verifyCode.create({
            data: {
                phonenumber: dto.phonenumber,
                code: verifyCode,
            },
        });

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                verify_code: verifyCode,
            },
        };
    }

    /**
     * Login - Đăng nhập
     */
    async login(dto: LoginDto) {
        if (dto.password === dto.phonenumber) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: 'Mật khẩu không được trùng với số điện thoại',
            };
        }

        const user = await this.prisma.user.findUnique({
            where: { phonenumber: dto.phonenumber },
        });

        if (!user) {
            return {
                code: ResponseCode.USER_NOT_VALIDATED,
                message: 'User is not validated',
            };
        }

        if (user.status === UserStatus.LOCKED) {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: 'Account is locked',
            };
        }

        if (user.password !== dto.password) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: 'Mật khẩu không chính xác',
            };
        }

        const token = this.tokenService.generateToken();
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                token: token,
                online: true,
            },
        });

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                id: user.id,
                username: user.username ?? '',
                token: token,
                avatar: user.avatar ?? '',
                role: user.role,
            },
        };
    }

    /**
     * Logout - Đăng xuất
     */
    async logout(token: string) {
        const user = await this.prisma.user.findFirst({
            where: { token },
        });

        if (!user) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: 'Token is invalid',
            };
        }

        // Xóa token
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                token: null,
                online: false,
            },
        });

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
        };
    }

    /**
     * Get Verify Code - Lấy lại mã xác thực
     */
    async getVerifyCode(phonenumber: string) {
        const user = await this.prisma.user.findUnique({
            where: { phonenumber },
        });

        if (!user) {
            return {
                code: ResponseCode.USER_NOT_VALIDATED,
                message: 'User is not validated',
            };
        }

        if (user.token) {
            return {
                code: ResponseCode.ACTION_NOT_VALID,
                message: 'Action is not valid',
            };
        }

        const existingCode = await this.prisma.verifyCode.findFirst({
            where: { phonenumber },
            orderBy: { createdAt: 'desc' },
        });

        if (existingCode) {
            const elapsed = Date.now() - existingCode.createdAt.getTime();
            if (elapsed < 120_000) {
                return {
                    code: ResponseCode.OK,
                    message: ResponseMessage[ResponseCode.OK],
                    data: {
                        verify_code: existingCode.code,
                    },
                };
            }
        }

        const verifyCode = this.tokenService.generateVerifyCode();

        await this.prisma.verifyCode.deleteMany({
            where: { phonenumber },
        });

        await this.prisma.verifyCode.create({
            data: {
                phonenumber,
                code: verifyCode,
            },
        });

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                verify_code: verifyCode,
            },
        };
    }

    /**
     * Check Verify Code - Xác nhận mã xác thực
     */
    async checkVerifyCode(dto: CheckVerifyCodeDto) {
        // Tìm user
        const user = await this.prisma.user.findUnique({
            where: { phonenumber: dto.phonenumber },
        });

        if (!user) {
            return {
                code: ResponseCode.USER_NOT_VALIDATED,
                message: 'User is not validated',
            };
        }

        if (user.token) {
            return {
                code: ResponseCode.USER_EXISTED,
                message: 'User existed',
            };
        }

        const verifyRecord = await this.prisma.verifyCode.findFirst({
            where: { phonenumber: dto.phonenumber },
            orderBy: { createdAt: 'desc' },
        });

        if (!verifyRecord || verifyRecord.code !== dto.code_verify) {
            return {
                code: ResponseCode.CODE_VERIFY_INCORRECT,
                message: 'Code verify is incorrect',
            };
        }

        await this.prisma.verifyCode.deleteMany({
            where: { phonenumber: dto.phonenumber },
        });

        const token = this.tokenService.generateToken();
        await this.prisma.user.update({
            where: { id: user.id },
            data: { token },
        });

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                id: user.id,
                token: token,
            },
        };
    }

    /**
     * Change Info After Signup - Thay đổi thông tin sau đăng ký
     */
    async changeInfoAfterSignup(dto: ChangeInfoAfterSignupDto) {
        // Validate token
        const user = await this.prisma.user.findFirst({
            where: { token: dto.token },
        });

        if (!user) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: 'Token is invalid',
            };
        }

        if (dto.username === user.phonenumber) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: 'Username không được trùng với số điện thoại',
            };
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                username: dto.username,
                avatar: dto.avatar ?? user.avatar,
                height: dto.height ?? user.height,
            },
        });

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                id: updatedUser.id,
                username: updatedUser.username ?? '',
                phonenumber: updatedUser.phonenumber,
                created: updatedUser.createdAt.toISOString(),
                avatar: updatedUser.avatar ?? '',
            },
        };
    }
}
