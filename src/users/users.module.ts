import { Module } from '@nestjs/common';
import { UsersController, UserInfoController } from './users.controller.ts';
import { UsersService } from './users.service.ts';

@Module({
    controllers: [UsersController, UserInfoController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}
