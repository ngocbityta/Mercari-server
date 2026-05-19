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
    UseInterceptors,
    UploadedFiles,
    Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { User, UserStatus } from '@prisma/client';
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
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum.ts';
import {
    PROFILE_USER_INFO_UPLOAD_OPTIONS,
    saveUserUploadedImage,
    type UploadedMultipartFileFields,
} from '../common/uploads/profile-upload.ts';

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
        private readonly usersService: UsersService,
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
    @UseInterceptors(
        FileFieldsInterceptor(
            [
                { name: 'avatar', maxCount: 1 },
                { name: 'cover_image', maxCount: 1 },
            ],
            PROFILE_USER_INFO_UPLOAD_OPTIONS,
        ),
    )
    async setUserInfo(
        @Req() request: Request,
        @Body() dto: SetUserInfoDto,
        @UploadedFiles() files: UploadedMultipartFileFields,
    ) {
        if (!request.is('multipart/form-data')) {
            return ApiResponse.error(
                ResponseCode.INVALID_PARAMETER_TYPE,
                'Content-Type must be multipart/form-data',
            );
        }

        const token = dto.token?.trim();
        if (!token) {
            return ApiResponse.error(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        const user = await this.usersService.findByToken(token);
        if (!user) {
            return ApiResponse.error(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (user.status === UserStatus.LOCKED) {
            return ApiResponse.error(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        const avatarFile = files?.avatar?.[0];
        const coverImageFile = files?.cover_image?.[0];

        let avatar: string | undefined;
        let coverImage: string | undefined;
        try {
            if (avatarFile) {
                avatar = await saveUserUploadedImage(avatarFile);
            }
            if (coverImageFile) {
                coverImage = await saveUserUploadedImage(coverImageFile);
            }
        } catch {
            return ApiResponse.error(
                ResponseCode.UPLOAD_FILE_FAILED,
                ResponseMessage[ResponseCode.UPLOAD_FILE_FAILED],
            );
        }

        try {
            const result = await this.profileService.setUserInfo(user, {
                username: dto.username,
                avatar,
                coverImage,
            });

            return ApiResponse.success({
                avatar: result.avatar,
                id: result.id,
                cover_image: result.coverImage,
                username: result.username,
            });
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
