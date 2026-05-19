import { SignupDto, LoginDto, CheckVerifyCodeDto, ChangeInfoAfterSignupDto } from './auth.dto.ts';
import type { UploadedMultipartFile } from '../common/uploads/profile-upload.ts';

export interface IAuthActions {
    signup(dto: SignupDto): Promise<any>;
    login(dto: LoginDto): Promise<any>;
    logout(token: string): Promise<any>;
    changeInfoAfterSignup(
        dto: ChangeInfoAfterSignupDto,
        avatarFile?: UploadedMultipartFile,
    ): Promise<any>;
}

export interface IVerificationActions {
    getVerifyCode(phonenumber: string): Promise<any>;
    checkVerifyCode(dto: CheckVerifyCodeDto): Promise<any>;
}
