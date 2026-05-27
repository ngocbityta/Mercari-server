import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.ts';
import { AuthController } from './auth.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';
import { TokenService } from './token.service.ts';
import { VerificationService } from './verification.service.ts';
import { UsersModule } from '../users/users.module.ts';
import { PostsModule } from '../posts/posts.module.ts';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [PrismaModule, UsersModule, PostsModule, ConfigModule],
    controllers: [AuthController],
    providers: [AuthService, TokenService, VerificationService],
    exports: [AuthService],
})
export class AuthModule {}
