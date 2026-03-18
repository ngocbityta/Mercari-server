import { User } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from './users.dto.ts';

export interface IUserQuery {
    findAll(): Promise<User[]>;
    findByPhonenumber(phonenumber: string): Promise<User | null>;
    findByToken(token: string): Promise<User | null>;
    findOne(id: string): Promise<User>;
}

export interface IUserCommand {
    create(createUserDto: CreateUserDto): Promise<User>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<User>;
    remove(id: string): Promise<void>;
    updateToken(userId: string, token: string | null, online?: boolean): Promise<void>;
}
