import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    BadRequestException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseCode } from '../../enums/response-code.enum.ts';
import { Prisma } from '@prisma/client';
import { ApiException } from '../exceptions/api.exception.ts';

interface HttpExceptionResponse {
    message?: string | string[];
    code?: ResponseCode;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let code = ResponseCode.EXCEPTION_ERROR;
        let message = 'Exception error';

        if (exception instanceof ApiException) {
            status = exception.getStatus();
            code = exception.code;
            message = exception.message;
        } else if (exception instanceof BadRequestException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse() as HttpExceptionResponse;
            let msg = exceptionResponse.message || 'Bad Request';

            if (Array.isArray(msg)) {
                msg = msg[0];
            }
            code = ResponseCode.INVALID_PARAMETER_VALUE;

            if (msg && typeof msg === 'string' && msg.includes('trống')) {
                code = ResponseCode.MISSING_PARAMETER;
            }
            message = msg;
        } else if (exception instanceof HttpException) {
            status = exception.getStatus();
            message = exception.message;
            // Try to extract code if it was passed in the exception body like in TokenGuard
            const resBody = exception.getResponse() as HttpExceptionResponse;
            if (resBody && typeof resBody === 'object' && resBody.code) {
                code = resBody.code;
            }
        } else if (
            exception instanceof Prisma.PrismaClientKnownRequestError ||
            exception instanceof Prisma.PrismaClientUnknownRequestError ||
            exception instanceof Prisma.PrismaClientInitializationError ||
            exception instanceof Prisma.PrismaClientRustPanicError
        ) {
            status = HttpStatus.OK; // Often standard for this API's errors
            code = ResponseCode.CAN_NOT_CONNECT;
            message = 'Can not connect to DB';
        }

        response.status(status).json({
            code: code,
            message: message,
        });
    }
}
