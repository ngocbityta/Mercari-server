import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from '../../entities/user.entity.ts';
import { UserStatus } from '../enums/user.enum.ts';

interface CustomRequest extends Request {
    body: { token?: string };
    user?: User;
}

@Injectable()
export class TokenGuard implements CanActivate {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<CustomRequest>();
        const token = request.body?.token;

        if (!token || typeof token !== 'string' || token.trim().length < 1) {
            throw new UnauthorizedException({
                code: '9998',
                message: 'Token is invalid',
            });
        }

        const user = await this.usersRepository.findOne({
            where: { token },
            select: {
                id: true,
                phonenumber: true,
                username: true,
                avatar: true,
                cover_image: true,
                description: true,
                role: true,
                token: true,
                status: true,
                online: true,
                created_at: true,
                updated_at: true,
            },
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
