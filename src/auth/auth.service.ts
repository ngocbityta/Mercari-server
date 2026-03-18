import { Injectable } from '@nestjs/common';
import { SignupDto, LoginDto, CheckVerifyCodeDto, ChangeInfoAfterSignupDto } from './auth.dto.ts';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum.ts';
import { UserStatus } from '@prisma/client';
import { TokenService } from './token.service.ts';
import { UsersService } from '../users/users.service.ts';
import { VerificationService } from './verification.service.ts';
import { IAuthActions, IVerificationActions } from './auth.interfaces.ts';

@Injectable()
export class AuthService implements IAuthActions, IVerificationActions {
    constructor(
        private readonly usersService: UsersService,
        private readonly tokenService: TokenService,
        private readonly verificationService: VerificationService,
    ) {}

    async signup(dto: SignupDto) {
        if (dto.password === dto.phonenumber) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: 'Mật khẩu không được trùng với số điện thoại',
            };
        }

        const existingUser = await this.usersService.findByPhonenumber(dto.phonenumber);
        if (existingUser) {
            return {
                code: ResponseCode.USER_EXISTED,
                message: 'User existed',
            };
        }

        await this.usersService.create({
            phonenumber: dto.phonenumber,
            password: dto.password,
            role: dto.role,
        });

        const verifyCode = await this.verificationService.generateAndStoreCode(dto.phonenumber);

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                verify_code: verifyCode,
            },
        };
    }

    async login(dto: LoginDto) {
        if (dto.password === dto.phonenumber) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: 'Mật khẩu không được trùng với số điện thoại',
            };
        }

        const user = await this.usersService.findByPhonenumber(dto.phonenumber);
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
        await this.usersService.updateToken(user.id, token, true);

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

    async logout(token: string) {
        const user = await this.usersService.findByToken(token);
        if (!user) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: 'Token is invalid',
            };
        }

        await this.usersService.updateToken(user.id, null, false);

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
        };
    }

    async getVerifyCode(phonenumber: string) {
        const user = await this.usersService.findByPhonenumber(phonenumber);
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

        const existingCode = await this.verificationService.getRecentCode(phonenumber);
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

        const verifyCode = await this.verificationService.generateAndStoreCode(phonenumber);

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                verify_code: verifyCode,
            },
        };
    }

    async checkVerifyCode(dto: CheckVerifyCodeDto) {
        const user = await this.usersService.findByPhonenumber(dto.phonenumber);
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

        const isValid = await this.verificationService.validateCode(
            dto.phonenumber,
            dto.code_verify,
        );
        if (!isValid) {
            return {
                code: ResponseCode.CODE_VERIFY_INCORRECT,
                message: 'Code verify is incorrect',
            };
        }

        await this.verificationService.deleteCodes(dto.phonenumber);

        const token = this.tokenService.generateToken();
        await this.usersService.updateToken(user.id, token);

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                id: user.id,
                token: token,
            },
        };
    }

    async changeInfoAfterSignup(dto: ChangeInfoAfterSignupDto) {
        const user = await this.usersService.findByToken(dto.token);
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

        const updatedUser = await this.usersService.update(user.id, {
            username: dto.username,
            avatar: dto.avatar,
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
