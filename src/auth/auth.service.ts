import { Injectable } from '@nestjs/common';
import { SignupDto, LoginDto, CheckVerifyCodeDto, ChangeInfoAfterSignupDto } from './auth.dto.ts';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum.ts';
import { UserStatus } from '@prisma/client';
import { TokenService } from './token.service.ts';
import { UsersService } from '../users/users.service.ts';
import { VerificationService } from './verification.service.ts';
import { IAuthActions, IVerificationActions } from './auth.interfaces.ts';
import { saveUserUploadedImage, UploadedMultipartFile } from '../common/uploads/profile-upload.ts';

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
                message: 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c trÃ¹ng vá»›i sá»‘ Ä‘iá»‡n thoáº¡i',
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
                verifyCode: verifyCode,
            },
        };
    }

    async login(dto: LoginDto) {
        if (dto.password === dto.phonenumber) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c trÃ¹ng vá»›i sá»‘ Ä‘iá»‡n thoáº¡i',
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
                message: 'Máº­t kháº©u khÃ´ng chÃ­nh xÃ¡c',
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
                code: ResponseCode.ACTION_DONE_PREVIOUSLY,
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
                        verifyCode: existingCode.code,
                    },
                };
            }
        }

        const verifyCode = await this.verificationService.generateAndStoreCode(phonenumber);

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                verifyCode: verifyCode,
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
            dto.codeVerify,
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

    async changeInfoAfterSignup(dto: ChangeInfoAfterSignupDto, avatarFile?: UploadedMultipartFile) {
        const token = dto.token?.trim();
        if (!token) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: 'Token is invalid',
            };
        }

        const user = await this.usersService.findByToken(token);
        if (!user) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: 'Token is invalid',
            };
        }

        if (!avatarFile) {
            return {
                code: ResponseCode.MISSING_PARAMETER,
                message: 'Avatar file is required',
            };
        }

        const updateData: { avatar: string; username?: string; height?: string } = {
            avatar: '',
        };

        if (dto.username !== undefined) {
            const usernameValidationError = this.validateChangeInfoUsername(
                dto.username,
                user.phonenumber,
            );
            if (usernameValidationError) {
                return {
                    code: ResponseCode.INVALID_PARAMETER_VALUE,
                    message: usernameValidationError,
                };
            }

            updateData.username = dto.username.trim();
        }

        let avatar: string;
        try {
            avatar = await saveUserUploadedImage(avatarFile);
        } catch {
            return {
                code: ResponseCode.UPLOAD_FILE_FAILED,
                message: ResponseMessage[ResponseCode.UPLOAD_FILE_FAILED],
            };
        }

        updateData.avatar = avatar;
        if (dto.height !== undefined) {
            updateData.height = dto.height;
        }

        const updatedUser = await this.usersService.update(user.id, updateData);

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

    private validateChangeInfoUsername(username: string, phonenumber: string): string | null {
        const normalizedUsername = username.trim();
        if (normalizedUsername.length < 3) {
            return 'Username is too short';
        }

        if (normalizedUsername.length > 50) {
            return 'Username is too long';
        }

        if (normalizedUsername === phonenumber || this.isPhoneNumberLike(normalizedUsername)) {
            return 'Username must not be a phone number';
        }

        if (this.isUrlLike(normalizedUsername)) {
            return 'Username must not be a URL';
        }

        if (this.isAddressLike(normalizedUsername)) {
            return 'Username must not be an address';
        }

        return null;
    }

    private isPhoneNumberLike(value: string): boolean {
        return /^0\d{9}$/.test(value) || /^\+?\d[\d\s.-]{8,}$/.test(value);
    }

    private isUrlLike(value: string): boolean {
        return (
            /^(https?:\/\/|www\.)/i.test(value) ||
            /\b[a-z0-9-]+\.(com|net|org|vn|io|dev)\b/i.test(value)
        );
    }

    private isAddressLike(value: string): boolean {
        const normalizedValue = value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/Ä‘/g, 'd')
            .replace(/Ä/g, 'D')
            .toLowerCase();

        return (
            /\d/.test(normalizedValue) &&
            /\b(duong|pho|phuong|quan|huyen|tinh|thanh pho|tp|street|road|avenue|district|ward)\b/.test(
                normalizedValue,
            )
        );
    }
}
