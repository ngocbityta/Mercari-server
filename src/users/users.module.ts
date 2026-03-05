import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController, UserInfoController } from './users.controller.ts';
import { UsersService } from './users.service.ts';
import { User } from '../entities/user.entity.ts';
import { Block } from '../entities/block.entity.ts';

@Module({
    imports: [TypeOrmModule.forFeature([User, Block])],
    controllers: [UsersController, UserInfoController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}
