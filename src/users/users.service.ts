import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.ts';
import { Block } from '../entities/block.entity.ts';
import { CreateUserDto } from './dto/create-user.dto.ts';
import { UpdateUserDto } from './dto/update-user.dto.ts';
import { UserStatus } from '../common/enums/user.enum.ts';

// Danh sách tên bị cấm
const BANNED_USERNAMES = ['hitier', 'admin', 'root', 'superadmin'];

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
        @InjectRepository(Block)
        private readonly blocksRepository: Repository<Block>,
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

    async getUserInfo(currentUser: User, targetUserId?: string) {
        if (!targetUserId || targetUserId === currentUser.id) {
            return this.formatUserInfo(currentUser);
        }

        const targetUser = await this.usersRepository.findOne({
            where: { id: targetUserId },
        });

        if (!targetUser || targetUser.status === UserStatus.LOCKED) {
            throw new NotFoundException('User not found');
        }

        const isBlocked = await this.blocksRepository.findOne({
            where: { blocker_id: targetUserId, blocked_id: currentUser.id },
        });

        if (isBlocked) {
            throw new NotFoundException('User not found');
        }

        return this.formatUserInfo(targetUser);
    }

    async setUserInfo(
        currentUser: User,
        data: { username?: string; avatar?: string; cover_image?: string; description?: string },
    ) {
        const user = await this.usersRepository.findOne({
            where: { id: currentUser.id },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (data.username !== undefined) {
            const normalizedUsername = data.username.trim();

            if (normalizedUsername.length === 0) {
                throw new BadRequestException('Username cannot be empty');
            }

            const usernameRegex = /^[a-zA-Z_][a-zA-Z_]*$/;
            if (!usernameRegex.test(normalizedUsername)) {
                throw new BadRequestException(
                    'Username can only contain letters and underscores, must start with a letter or underscore',
                );
            }

            if (normalizedUsername.length > 50) {
                throw new BadRequestException('Username is too long');
            }

            if (BANNED_USERNAMES.includes(normalizedUsername.toLowerCase())) {
                throw new BadRequestException('This username is not allowed');
            }

            user.username = normalizedUsername;
        }

        if (data.avatar !== undefined) {
            user.avatar = data.avatar;
        }

        if (data.cover_image !== undefined) {
            user.cover_image = data.cover_image;
        }

        if (data.description !== undefined) {
            user.description = data.description;
        }

        const savedUser = await this.usersRepository.save(user);
        return this.formatUserInfo(savedUser);
    }

    async changePassword(user: User, password: string, newPassword: string) {
        if (password === newPassword) {
            throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ');
        }

        const isMatch = user.password === password; // Implement properly with bcrypt in real world if hashed
        if (!isMatch) {
            throw new BadRequestException('Mật khẩu cũ không chính xác');
        }

        if (newPassword.length < 6 || newPassword.length > 50) {
            throw new BadRequestException('Mật khẩu mới phải từ 6 đến 50 ký tự');
        }

        // Very basic simple overlap check (e.g. 80% similarity threshold)
        const getLongestCommonSubstring = (s1: string, s2: string): number => {
            const m = s1.length;
            const n = s2.length;
            let maxLen = 0;
            const dp: number[][] = Array.from(
                { length: m + 1 },
                () => Array(n + 1).fill(0) as number[],
            );
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    if (s1[i - 1] === s2[j - 1]) {
                        dp[i][j] = dp[i - 1][j - 1] + 1;
                        maxLen = Math.max(maxLen, dp[i][j]);
                    }
                }
            }
            return maxLen;
        };

        const lcsLength = getLongestCommonSubstring(password, newPassword);
        if (lcsLength / newPassword.length >= 0.8) {
            throw new BadRequestException('Mật khẩu mới quá giống mật khẩu cũ');
        }

        user.password = newPassword; // Need hash in real world
        await this.usersRepository.save(user);

        return {};
    }

    async setBlock(currentUser: User, targetUserId: string, type: string) {
        if (currentUser.id === targetUserId) {
            throw new BadRequestException('Bạn không thể chặn chính mình');
        }

        const targetUser = await this.usersRepository.findOne({ where: { id: targetUserId } });
        if (!targetUser) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        if (targetUser.status === UserStatus.LOCKED) {
            throw new BadRequestException('Người dùng này đã bị khóa');
        }

        if (type !== '0' && type !== '1') {
            throw new BadRequestException('Loại hành động không hợp lệ');
        }

        const existingBlock = await this.blocksRepository.findOne({
            where: { blocker_id: currentUser.id, blocked_id: targetUserId },
        });

        if (type === '0') {
            // Block usage
            if (existingBlock) {
                throw new BadRequestException('Bạn đã chặn người này rồi');
            }
            const block = this.blocksRepository.create({
                blocker_id: currentUser.id,
                blocked_id: targetUserId,
            });
            await this.blocksRepository.save(block);
        } else {
            // Unblock usage
            if (!existingBlock) {
                throw new BadRequestException('Bạn chưa từng chặn người này');
            }
            await this.blocksRepository.remove(existingBlock);
        }

        return {};
    }

    checkNewVersion(user: User, lastUpdate: string) {
        if (!lastUpdate || typeof lastUpdate !== 'string') {
            throw new BadRequestException('Parameter last_update is required');
        }

        // Dummy logic to return standard structure since we don't have a notifications module integrated right here
        // that allows counting unread messages or notifications yet.
        return {
            version: {
                version: '1.0.0', // Real-world: from DB setup
                active: user.status === UserStatus.ACTIVE ? '1' : '0',
                required: '0',
                url: 'https://example.com/app',
            },
            user: {
                id: user.id,
                active: user.status === UserStatus.ACTIVE ? '1' : '0',
            },
            badge: '0',
            unread_message: '0',
            now: '1.0.0',
        };
    }

    private formatUserInfo(user: User) {
        return {
            id: user.id,
            username: user.username ?? '',
            avatar: user.avatar ?? '',
            cover_image: user.cover_image ?? '',
            description: user.description ?? '',
            online: user.online ? '1' : '0',
            created: user.created_at?.toISOString() ?? '',
        };
    }
}
