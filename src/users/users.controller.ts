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
import { ProfileService } from './profile.service.ts';
import { AccountService } from './account.service.ts';
import { BlockService } from './block.service.ts';
import {
    CreateUserDto,
    UpdateUserDto,
    GetUserInfoDto,
    SetUserInfoDto,
    ChangePasswordDto,
    SetBlockDto,
    CheckNewVersionDto,
} from './users.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import type { User } from '@prisma/client';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

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
    constructor(
        private readonly profileService: ProfileService,
        private readonly accountService: AccountService,
        private readonly blockService: BlockService,
    ) {}

    @Post('get_user_info')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getUserInfo(@Body() dto: GetUserInfoDto, @CurrentUser() user: User) {
        try {
            const result = await this.profileService.getUserInfo(user, dto.userId);
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
            const result = await this.profileService.setUserInfo(user, {
                username: dto.username,
                avatar: dto.avatar,
                coverImage: dto.coverImage,
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
            const result = await this.accountService.changePassword(
                user,
                dto.password,
                dto.newPassword,
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
            const result = await this.blockService.setBlock(user, dto.userId, dto.type);
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
            const result = this.accountService.checkNewVersion(user, dto.lastUpdate);
            return ApiResponse.success(result);
        } catch (error) {
            if (error instanceof Error) {
                return ApiResponse.error(ResponseCode.INVALID_PARAMETER_VALUE, error.message);
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }
}
