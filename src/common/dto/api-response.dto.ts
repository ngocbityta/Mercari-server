import { ResponseCode, ResponseMessage } from '../../enums/response-code.enum.ts';

export class ApiResponse<T = any> {
    code: string;
    message: string;
    data?: T;

    constructor(code: ResponseCode, data?: T, message?: string) {
        this.code = code;
        this.message = message ?? ResponseMessage[code] ?? 'Unknown';
        if (data !== undefined) {
            this.data = data;
        }
    }

    static success<T>(data?: T): ApiResponse<T> {
        return new ApiResponse(ResponseCode.OK, data);
    }

    static error(code: ResponseCode, message?: string): ApiResponse {
        return new ApiResponse(code, undefined, message);
    }
}
