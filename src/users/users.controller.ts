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
    GetListBlocksDto,
} from './users.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import type { User } from '@prisma/client';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';
import { ApiException } from '../common/exceptions/api.exception.ts';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createUserDto: CreateUserDto) {
        const result = await this.usersService.create(createUserDto);
        return ApiResponse.success(result);
    }

    @Get()
    async findAll() {
        const result = await this.usersService.findAll();
        return ApiResponse.success(result);
    }

    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        const result = await this.usersService.findOne(id);
        return ApiResponse.success(result);
    }

    @Patch(':id')
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserDto) {
        const result = await this.usersService.update(id, updateUserDto);
        return ApiResponse.success(result);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.usersService.remove(id);
        return ApiResponse.success({});
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
        const result = await this.profileService.getUserInfo(user, dto.userId);
        return ApiResponse.success(result);
    }

    @Post('set_user_info')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setUserInfo(@Body() dto: SetUserInfoDto, @CurrentUser() user: User) {
        const result = await this.profileService.setUserInfo(user, {
            username: dto.username,
            avatar: dto.avatar,
            coverImage: dto.coverImage,
            description: dto.description,
        });
        return ApiResponse.success(result);
    }

    @Post('change_password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: User) {
        const result = await this.accountService.changePassword(
            user,
            dto.password,
            dto.newPassword,
        );
        return ApiResponse.success(result);
    }

    @Post('set_block')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setBlock(@Body() dto: SetBlockDto, @CurrentUser() user: User) {
        if (user.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'User account is locked');
        }

        const result = await this.blockService.setBlock(user, dto.userId, dto.type);
        return ApiResponse.success(result);
    }

    @Post('check_new_version')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    checkNewVersion(@Body() dto: CheckNewVersionDto, @CurrentUser() user: User) {
        const result = this.accountService.checkNewVersion(user, dto.lastUpdate);
        return ApiResponse.success(result);
    }

    @Post('get_list_blocks')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getListBlocks(@Body() dto: GetListBlocksDto, @CurrentUser() user: User) {
        const result = await this.blockService.getListBlocks(
            user,
            dto.index,
            dto.count,
            dto.user_id,
        );
        return ApiResponse.success(result);
    }
}
