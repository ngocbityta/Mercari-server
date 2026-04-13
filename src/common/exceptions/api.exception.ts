import { HttpException, HttpStatus } from '@nestjs/common';
import { ResponseCode } from '../../enums/response-code.enum.ts';

export class ApiException extends HttpException {
    public readonly code: ResponseCode;

    constructor(code: ResponseCode, message?: string, status: HttpStatus = HttpStatus.OK) {
        super(message || 'Api Error', status);
        this.code = code;
    }
}
