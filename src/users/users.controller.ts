import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.ts';
import { CreateUserDto } from './dto/create-user.dto.ts';
import { UpdateUserDto } from './dto/update-user.dto.ts';
import {
    GetUserInfoDto,
    SetUserInfoDto,
    ChangePasswordDto,
    SetBlockDto,
    CheckNewVersionDto,
} from './dto/user-info.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import { User } from '../entities/user.entity.ts';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../common/enums/response-code.enum.ts';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }

    @Get()
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.remove(id);
    }
}

@Controller()
export class UserInfoController {
    constructor(private readonly usersService: UsersService) {}

    @Post('get_user_info')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getUserInfo(@Body() dto: GetUserInfoDto, @CurrentUser() user: User) {
        try {
            const result = await this.usersService.getUserInfo(user, dto.user_id);
            return ApiResponse.success(result);
        } catch (error) {
            if (error instanceof Error && error.message === 'User not found') {
                return ApiResponse.error(ResponseCode.NO_DATA, 'User not found');
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('set_user_info')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setUserInfo(@Body() dto: SetUserInfoDto, @CurrentUser() user: User) {
        try {
            const result = await this.usersService.setUserInfo(user, {
                username: dto.username,
                avatar: dto.avatar,
                cover_image: dto.cover_image,
                description: dto.description,
            });
            return ApiResponse.success(result);
        } catch (error) {
            if (error instanceof Error) {
                return ApiResponse.error(ResponseCode.INVALID_PARAMETER_VALUE, error.message);
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('change_password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: User) {
        try {
            const result = await this.usersService.changePassword(
                user,
                dto.password,
                dto.new_password,
            );
            return ApiResponse.success(result);
        } catch (error) {
            if (error instanceof Error) {
                return ApiResponse.error(ResponseCode.INVALID_PARAMETER_VALUE, error.message);
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('set_block')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setBlock(@Body() dto: SetBlockDto, @CurrentUser() user: User) {
        try {
            const result = await this.usersService.setBlock(user, dto.user_id, dto.type);
            return ApiResponse.success(result);
        } catch (error) {
            if (error instanceof Error) {
                return ApiResponse.error(ResponseCode.INVALID_PARAMETER_VALUE, error.message);
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('check_new_version')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    checkNewVersion(@Body() dto: CheckNewVersionDto, @CurrentUser() user: User) {
        try {
            const result = this.usersService.checkNewVersion(user, dto.last_update);
            return ApiResponse.success(result);
        } catch (error) {
            if (error instanceof Error) {
                return ApiResponse.error(ResponseCode.INVALID_PARAMETER_VALUE, error.message);
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }
}
