import { Injectable } from '@nestjs/common';
import { SignupDto, LoginDto, CheckVerifyCodeDto, ChangeInfoAfterSignupDto } from './auth.dto.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';
import { UserStatus } from '@prisma/client';
import { TokenService } from './token.service.ts';
import { UsersService } from '../users/users.service.ts';
import { VerificationService } from './verification.service.ts';
import { IAuthActions, IVerificationActions } from './auth.interfaces.ts';
import { ApiException } from '../common/exceptions/api.exception.ts';

@Injectable()
export class AuthService implements IAuthActions, IVerificationActions {
    constructor(
        private readonly usersService: UsersService,
        private readonly tokenService: TokenService,
        private readonly verificationService: VerificationService,
    ) {}

    async signup(dto: SignupDto) {
        if (dto.password === dto.phonenumber) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Mật khẩu không được trùng với số điện thoại',
            );
        }

        const existingUser = await this.usersService.findByPhonenumber(dto.phonenumber);
        if (existingUser) {
            throw new ApiException(ResponseCode.USER_EXISTED, 'User existed');
        }

        await this.usersService.create({
            phonenumber: dto.phonenumber,
            password: dto.password,
            role: dto.role,
        });

        const verifyCode = await this.verificationService.generateAndStoreCode(dto.phonenumber);

        return {
            verifyCode: verifyCode,
        };
    }

    async login(dto: LoginDto) {
        if (dto.password === dto.phonenumber) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Mật khẩu không được trùng với số điện thoại',
            );
        }

        const user = await this.usersService.findByPhonenumber(dto.phonenumber);
        if (!user) {
            throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User is not validated');
        }

        if (user.status === UserStatus.LOCKED) {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        if (user.password !== dto.password) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Mật khẩu không chính xác',
            );
        }

        const token = this.tokenService.generateToken();
        await this.usersService.updateToken(user.id, token, true);

        return {
            id: user.id,
            username: user.username ?? '',
            token: token,
            avatar: user.avatar ?? '',
            role: user.role,
        };
    }

    async logout(token: string) {
        const user = await this.usersService.findByToken(token);
        if (!user) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        await this.usersService.updateToken(user.id, null, false);

        return {};
    }

    async getVerifyCode(phonenumber: string) {
        const user = await this.usersService.findByPhonenumber(phonenumber);
        if (!user) {
            throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User is not validated');
        }

        if (user.token) {
            throw new ApiException(ResponseCode.ACTION_DONE_PREVIOUSLY, 'Action is not valid');
        }

        const existingCode = await this.verificationService.getRecentCode(phonenumber);
        if (existingCode) {
            const elapsed = Date.now() - existingCode.createdAt.getTime();
            if (elapsed < 120_000) {
                return {
                    verifyCode: existingCode.code,
                };
            }
        }

        const verifyCode = await this.verificationService.generateAndStoreCode(phonenumber);

        return {
            verifyCode: verifyCode,
        };
    }

    async checkVerifyCode(dto: CheckVerifyCodeDto) {
        const user = await this.usersService.findByPhonenumber(dto.phonenumber);
        if (!user) {
            throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User is not validated');
        }

        if (user.token) {
            throw new ApiException(ResponseCode.USER_EXISTED, 'User existed');
        }

        const isValid = await this.verificationService.validateCode(
            dto.phonenumber,
            dto.codeVerify,
        );
        if (!isValid) {
            throw new ApiException(ResponseCode.CODE_VERIFY_INCORRECT, 'Code verify is incorrect');
        }

        await this.verificationService.deleteCodes(dto.phonenumber);

        const token = this.tokenService.generateToken();
        await this.usersService.updateToken(user.id, token);

        return {
            id: user.id,
            token: token,
        };
    }

    async changeInfoAfterSignup(dto: ChangeInfoAfterSignupDto) {
        const user = await this.usersService.findByToken(dto.token);
        if (!user) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (dto.username === user.phonenumber) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Username không được trùng với số điện thoại',
            );
        }

        const updatedUser = await this.usersService.update(user.id, {
            username: dto.username,
            avatar: dto.avatar,
        });

        return {
            id: updatedUser.id,
            username: updatedUser.username ?? '',
            phonenumber: updatedUser.phonenumber,
            created: updatedUser.createdAt.toISOString(),
            avatar: updatedUser.avatar ?? '',
        };
    }
}
