import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseCode } from '../../enums/response-code.enum.ts';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();

        if (exception instanceof BadRequestException) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const exceptionResponse = exception.getResponse() as any;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            let message = exceptionResponse.message || 'Bad Request';

            if (Array.isArray(message)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                message = message[0];
            }
            let code = ResponseCode.INVALID_PARAMETER_VALUE;
            if (message && typeof message === 'string' && message.includes('trống')) {
                code = ResponseCode.MISSING_PARAMETER;
            }

            return response.status(status).json({
                code: code,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                message: message,
            });
        }

        response.status(status).json({
            code: status.toString(),
            message: exception.message,
        });
    }
}
