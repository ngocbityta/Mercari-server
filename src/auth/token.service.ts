import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as randomstring from 'randomstring';

@Injectable()
export class TokenService {
    /**
     * Sinh token xác thực cho phiên đăng nhập
     */
    generateToken(): string {
        return randomUUID();
    }

    /**
     * Sinh mã xác thực 6 ký tự (chữ + số)
     */
    generateVerifyCode(): string {
        return randomstring.generate({
            length: 6,
            charset: 'alphanumeric',
        });
    }
}
