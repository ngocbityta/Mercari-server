import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { DevicesService } from './devices.service.ts';
import { SetDevtokenDto } from './dto/device.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import { User } from '../entities/user.entity.ts';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../common/enums/response-code.enum.ts';

@Controller()
export class DevicesController {
    constructor(private readonly devicesService: DevicesService) {}

    @Post('set_devtoken')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setDevtoken(@Body() dto: SetDevtokenDto, @CurrentUser() user: User) {
        try {
            const devtype = parseInt(dto.devtype, 10);
            if (isNaN(devtype)) {
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
        } catch {
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }
}
