import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { DevicesService } from './devices.service.ts';
import { SetDevtokenDto } from './devices.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';
import { Prisma, type User } from '@prisma/client';

@Controller()
export class DevicesController {
    constructor(private readonly devicesService: DevicesService) {}

    @Post('set_devtoken')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setDevtoken(@Body() dto: SetDevtokenDto, @CurrentUser() user: User) {
        try {
            const devtype = dto.devtype;
            if (typeof devtype !== 'number' || isNaN(devtype)) {
                return ApiResponse.error(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Invalid devtype value',
                );
            }

            if (!dto.devtoken || dto.devtoken.trim().length === 0) {
                return ApiResponse.error(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Invalid devtoken value',
                );
            }

            const result = await this.devicesService.setDevtoken(user, devtype, dto.devtoken);
            return ApiResponse.success(result);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError ||
                error instanceof Prisma.PrismaClientUnknownRequestError ||
                error instanceof Prisma.PrismaClientInitializationError ||
                error instanceof Prisma.PrismaClientRustPanicError
            ) {
                return ApiResponse.error(ResponseCode.CAN_NOT_CONNECT, 'Can not connect to DB');
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }
}
