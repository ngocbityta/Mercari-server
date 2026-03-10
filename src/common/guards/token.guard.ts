import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.ts';
import { User, UserStatus } from '@prisma/client';

interface CustomRequest extends Request {
    body: { token?: string };
    user?: User;
}

@Injectable()
export class TokenGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<CustomRequest>();
        const token = request.body?.token;

        if (!token || typeof token !== 'string' || token.trim().length < 1) {
            throw new UnauthorizedException({
                code: '9998',
                message: 'Token is invalid',
            });
        }

        const user = await this.prisma.user.findFirst({
            where: { token: token },
        });

        if (!user) {
            throw new UnauthorizedException({
                code: '9998',
                message: 'Token is invalid',
            });
        }

        if (user.status === UserStatus.LOCKED) {
            throw new UnauthorizedException({
                code: '9991',
                message: 'Account is locked',
            });
        }

        request.user = user;
        return true;
    }
}
