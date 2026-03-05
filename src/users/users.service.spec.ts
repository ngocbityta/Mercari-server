import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service.ts';
import { User } from '../entities/user.entity.ts';
import { Block } from '../entities/block.entity.ts';
import { CreateUserDto } from './dto/create-user.dto.ts';
import { UpdateUserDto } from './dto/update-user.dto.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';

// Mock user data
const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phonenumber: '0901234567',
    password: 'hashedPassword123',
    username: 'testuser',
    avatar: null,
    cover_image: null,
    description: null,
    role: UserRole.HV,
    token: null,
    status: UserStatus.ACTIVE,
    online: false,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
};

const mockUsersList: User[] = [
    mockUser,
    {
        ...mockUser,
        id: '550e8400-e29b-41d4-a716-446655440001',
        phonenumber: '0907654321',
        username: 'testuser2',
        role: UserRole.GV,
    },
];

// Mock repository
const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
});

type MockRepository<T extends Record<string, any> = any> = Partial<
    Record<keyof Repository<T>, jest.Mock>
>;

describe('UsersService', () => {
    let service: UsersService;
    let repository: MockRepository<User>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getRepositoryToken(User),
                    useFactory: mockRepository,
                },
                {
                    provide: getRepositoryToken(Block),
                    useFactory: mockRepository,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        repository = module.get<MockRepository<User>>(getRepositoryToken(User));
        // Need blocks repository for getUserInfo mock
        // Since we didn't define it in describe scope, let's keep it simple.
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        const createUserDto: CreateUserDto = {
            phonenumber: '0901234567',
            password: 'password123',
            role: UserRole.HV,
            username: 'testuser',
        };

        it('should create a new user successfully', async () => {
            repository.findOne!.mockResolvedValue(null); // Không tìm thấy user trùng
            repository.create!.mockReturnValue(mockUser);
            repository.save!.mockResolvedValue(mockUser);

            const result = await service.create(createUserDto);

            expect(repository.findOne).toHaveBeenCalledWith({
                where: { phonenumber: createUserDto.phonenumber },
            });
            expect(repository.create).toHaveBeenCalledWith(createUserDto);
            expect(repository.save).toHaveBeenCalledWith(mockUser);
            expect(result).toEqual(mockUser);
        });

        it('should throw ConflictException if phonenumber already exists', async () => {
            repository.findOne!.mockResolvedValue(mockUser); // Tìm thấy user trùng

            await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
            expect(repository.create).not.toHaveBeenCalled();
            expect(repository.save).not.toHaveBeenCalled();
        });
    });

    describe('findAll', () => {
        it('should return an array of users', async () => {
            repository.find!.mockResolvedValue(mockUsersList);

            const result = await service.findAll();

            expect(repository.find).toHaveBeenCalledWith({
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
            expect(result).toEqual(mockUsersList);
            expect(result).toHaveLength(2);
        });

        it('should return empty array when no users exist', async () => {
            repository.find!.mockResolvedValue([]);

            const result = await service.findAll();

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });
    });

    describe('findOne', () => {
        it('should return a user by id', async () => {
            repository.findOne!.mockResolvedValue(mockUser);

            const result = await service.findOne(mockUser.id);

            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: mockUser.id },
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
            expect(result).toEqual(mockUser);
        });

        it('should throw NotFoundException if user not found', async () => {
            repository.findOne!.mockResolvedValue(null);

            await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
        });
    });

    describe('update', () => {
        const updateUserDto: UpdateUserDto = {
            username: 'updateduser',
        };

        it('should update a user successfully', async () => {
            const updatedUser = { ...mockUser, username: 'updateduser' };

            // findOne mock (called by this.findOne inside update)
            repository.findOne!.mockResolvedValue(mockUser);
            repository.save!.mockResolvedValue(updatedUser);

            const result = await service.update(mockUser.id, updateUserDto);

            expect(repository.save).toHaveBeenCalled();
            expect(result.username).toBe('updateduser');
        });

        it('should throw NotFoundException if user to update not found', async () => {
            repository.findOne!.mockResolvedValue(null);

            await expect(service.update('nonexistent-id', updateUserDto)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ConflictException if updating to existing phonenumber', async () => {
            const updatePhoneDto: UpdateUserDto = {
                phonenumber: '0907654321',
            };

            const existingUserWithPhone = {
                ...mockUser,
                id: 'different-id',
                phonenumber: '0907654321',
            };

            // Lần gọi findOne đầu tiên (this.findOne) → tìm thấy user cần update
            // Lần gọi findOne thứ hai (kiểm tra phone trùng) → tìm thấy user khác
            repository
                .findOne!.mockResolvedValueOnce(mockUser) // findOne by id
                .mockResolvedValueOnce(existingUserWithPhone); // findOne by phone

            await expect(service.update(mockUser.id, updatePhoneDto)).rejects.toThrow(
                ConflictException,
            );
        });

        it('should allow updating phonenumber if not taken', async () => {
            const updatePhoneDto: UpdateUserDto = {
                phonenumber: '0999999999',
            };

            const updatedUser = { ...mockUser, phonenumber: '0999999999' };

            repository.findOne!.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null);
            repository.save!.mockResolvedValue(updatedUser);

            const result = await service.update(mockUser.id, updatePhoneDto);

            expect(result.phonenumber).toBe('0999999999');
        });
    });

    describe('remove', () => {
        it('should remove a user successfully', async () => {
            repository.findOne!.mockResolvedValue(mockUser);
            repository.remove!.mockResolvedValue(mockUser);

            await expect(service.remove(mockUser.id)).resolves.toBeUndefined();

            expect(repository.remove).toHaveBeenCalledWith(mockUser);
        });

        it('should throw NotFoundException if user to remove not found', async () => {
            repository.findOne!.mockResolvedValue(null);

            await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);

            expect(repository.remove).not.toHaveBeenCalled();
        });
    });

    describe('getUserInfo', () => {
        it('should return current user info if targetUserId is empty', async () => {
            const result = await service.getUserInfo(mockUser);
            expect(result.id).toBe(mockUser.id);
            expect(result.username).toBe(mockUser.username);
        });

        it('should throw NotFoundException if target user is LOCKED', async () => {
            const lockedUser = { ...mockUsersList[1], status: UserStatus.LOCKED };
            repository.findOne!.mockResolvedValue(lockedUser);
            await expect(service.getUserInfo(mockUser, lockedUser.id)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('setUserInfo', () => {
        it('should update user info successfully', async () => {
            // Mock repository findOne (used inside setUserInfo)
            repository.findOne!.mockResolvedValueOnce(mockUser);
            repository.save!.mockResolvedValueOnce({ ...mockUser, username: 'valid_name' });

            const result = await service.setUserInfo(mockUser, { username: 'valid_name' });
            expect(result.username).toBe('valid_name');
            expect(repository.save).toHaveBeenCalled();
        });

        it('should throw BadRequestException for banned username', async () => {
            repository.findOne!.mockResolvedValueOnce(mockUser);
            await expect(service.setUserInfo(mockUser, { username: 'admin' })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw BadRequestException for invalid characters in username', async () => {
            repository.findOne!.mockResolvedValueOnce(mockUser);
            await expect(
                service.setUserInfo(mockUser, { username: 'invalid name @' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if username is too long', async () => {
            repository.findOne!.mockResolvedValueOnce(mockUser);
            const longName = 'a'.repeat(51);
            await expect(service.setUserInfo(mockUser, { username: longName })).rejects.toThrow(
                BadRequestException,
            );
        });
    });
});
