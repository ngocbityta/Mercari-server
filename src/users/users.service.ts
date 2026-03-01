import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.ts';
import { CreateUserDto } from './dto/create-user.dto.ts';
import { UpdateUserDto } from './dto/update-user.dto.ts';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {}

    async create(createUserDto: CreateUserDto): Promise<User> {
        const existingUser = await this.usersRepository.findOne({
            where: { phonenumber: createUserDto.phonenumber },
        });

        if (existingUser) {
            throw new ConflictException('Số điện thoại đã được đăng ký');
        }

        const user = this.usersRepository.create(createUserDto);
        return this.usersRepository.save(user);
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find({
            select: {
                id: true,
                phonenumber: true,
                username: true,
                avatar: true,
                cover_image: true,
                description: true,
                role: true,
                status: true,
                online: true,
                created_at: true,
                updated_at: true,
            },
        });
    }

    async findOne(id: string): Promise<User> {
        const user = await this.usersRepository.findOne({
            where: { id },
            select: {
                id: true,
                phonenumber: true,
                username: true,
                avatar: true,
                cover_image: true,
                description: true,
                role: true,
                status: true,
                online: true,
                created_at: true,
                updated_at: true,
            },
        });

        if (!user) {
            throw new NotFoundException(`Không tìm thấy người dùng với id: ${id}`);
        }

        return user;
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user = await this.findOne(id);

        if (updateUserDto.phonenumber && updateUserDto.phonenumber !== user.phonenumber) {
            const existingUser = await this.usersRepository.findOne({
                where: { phonenumber: updateUserDto.phonenumber },
            });

            if (existingUser) {
                throw new ConflictException('Số điện thoại đã được đăng ký');
            }
        }

        Object.assign(user, updateUserDto);
        return this.usersRepository.save(user);
    }

    async remove(id: string): Promise<void> {
        const user = await this.findOne(id);
        await this.usersRepository.remove(user);
    }
}
