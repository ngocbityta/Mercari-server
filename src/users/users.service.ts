import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateUserDto, UpdateUserDto } from './users.dto.ts';
import { User } from '@prisma/client';
import { IUserQuery, IUserCommand } from './users.interfaces.ts';

@Injectable()
export class UsersService implements IUserQuery, IUserCommand {
    constructor(private readonly prisma: PrismaService) {}

    async create(createUserDto: CreateUserDto): Promise<User> {
        const existingUser = await this.prisma.user.findUnique({
            where: { phonenumber: createUserDto.phonenumber },
        });

        if (existingUser) {
            throw new ConflictException('Số điện thoại đã được đăng ký');
        }

        return this.prisma.user.create({
            data: {
                phonenumber: createUserDto.phonenumber,
                password: createUserDto.password,
                role: createUserDto.role,
                username: createUserDto.username,
                avatar: createUserDto.avatar,
                coverImage: createUserDto.coverImage,
                description: createUserDto.description,
            },
        });
    }

    async findAll(): Promise<User[]> {
        return this.prisma.user.findMany({
            select: {
                id: true,
                phonenumber: true,
                username: true,
                avatar: true,
                coverImage: true,
                description: true,
                role: true,
                status: true,
                online: true,
                createdAt: true,
                updatedAt: true,
                password: true,
                token: true,
            },
        }) as unknown as Promise<User[]>;
    }

    async findByPhonenumber(phonenumber: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { phonenumber },
        });
    }

    async findByToken(token: string): Promise<User | null> {
        return this.prisma.user.findFirst({
            where: { token },
        });
    }

    async findOne(id: string): Promise<User> {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException(`Không tìm thấy người dùng với id: ${id}`);
        }

        return user;
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user = await this.findOne(id);

        if (updateUserDto.phonenumber && updateUserDto.phonenumber !== user.phonenumber) {
            const existingUser = await this.prisma.user.findUnique({
                where: { phonenumber: updateUserDto.phonenumber },
            });

            if (existingUser) {
                throw new ConflictException('Số điện thoại đã được đăng ký');
            }
        }

        return this.prisma.user.update({
            where: { id },
            data: {
                phonenumber: updateUserDto.phonenumber,
                password: updateUserDto.password,
                role: updateUserDto.role,
                username: updateUserDto.username,
                avatar: updateUserDto.avatar,
                coverImage: updateUserDto.coverImage,
                description: updateUserDto.description,
                status: updateUserDto.status,
                online: updateUserDto.online,
            },
        });
    }

    async remove(id: string): Promise<void> {
        await this.findOne(id);
        await this.prisma.user.delete({
            where: { id },
        });
    }

    async updateToken(userId: string, token: string | null, online?: boolean): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                token,
                ...(online !== undefined ? { online } : {}),
            },
        });
    }
}
