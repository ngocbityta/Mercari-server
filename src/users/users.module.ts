import { Module } from '@nestjs/common';
import { UsersController, UserInfoController } from './users.controller.ts';
import { UsersService } from './users.service.ts';
import { ProfileService } from './profile.service.ts';
import { AccountService } from './account.service.ts';
import { BlockService } from './block.service.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';
import { PostsModule } from '../posts/posts.module.ts';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [PrismaModule, PostsModule, ConfigModule],
    controllers: [UsersController, UserInfoController],
    providers: [UsersService, ProfileService, AccountService, BlockService],
    exports: [UsersService, ProfileService, AccountService, BlockService],
})
export class UsersModule {}
