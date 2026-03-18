import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.ts';
import { AuthController } from './auth.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';
import { TokenService } from './token.service.ts';
import { VerificationService } from './verification.service.ts';
import { UsersModule } from '../users/users.module.ts';

@Module({
    imports: [PrismaModule, UsersModule],
    controllers: [AuthController],
    providers: [AuthService, TokenService, VerificationService],
    exports: [AuthService],
})
export class AuthModule {}
