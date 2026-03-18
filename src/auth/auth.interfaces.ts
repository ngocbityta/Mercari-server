import { SignupDto, LoginDto, CheckVerifyCodeDto, ChangeInfoAfterSignupDto } from './auth.dto.ts';

export interface IAuthActions {
    signup(dto: SignupDto): Promise<any>;
    login(dto: LoginDto): Promise<any>;
    logout(token: string): Promise<any>;
    changeInfoAfterSignup(dto: ChangeInfoAfterSignupDto): Promise<any>;
}

export interface IVerificationActions {
    getVerifyCode(phonenumber: string): Promise<any>;
    checkVerifyCode(dto: CheckVerifyCodeDto): Promise<any>;
}
