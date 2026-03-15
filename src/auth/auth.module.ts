import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.ts';
import { AuthController } from './auth.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';
import { TokenService } from './token.service.ts';

@Module({
    imports: [PrismaModule],
    controllers: [AuthController],
    providers: [AuthService, TokenService],
    exports: [AuthService],
})
export class AuthModule {}
