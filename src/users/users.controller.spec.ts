import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.ts';
import { UsersService } from './users.service.ts';
import { CreateUserDto } from './dto/create-user.dto.ts';
import { UpdateUserDto } from './dto/update-user.dto.ts';
import { User } from '../entities/user.entity.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';
import { ConflictException, NotFoundException } from '@nestjs/common';

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

// Mock UsersService
const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
};

describe('UsersController', () => {
    let controller: UsersController;
    let service: typeof mockUsersService;

    beforeEach(async () => {
        // Reset tất cả mock trước mỗi test
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
        service = module.get(UsersService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ============================================
    // POST /users - Create
    // ============================================
    describe('create', () => {
        const createUserDto: CreateUserDto = {
            phonenumber: '0901234567',
            password: 'password123',
            role: UserRole.HV,
            username: 'testuser',
        };

        it('should create a new user', async () => {
            service.create.mockResolvedValue(mockUser);

            const result = await controller.create(createUserDto);

            expect(service.create).toHaveBeenCalledWith(createUserDto);
            expect(result).toEqual(mockUser);
        });

        it('should propagate ConflictException from service', async () => {
            service.create.mockRejectedValue(
                new ConflictException('Số điện thoại đã được đăng ký'),
            );

            await expect(controller.create(createUserDto)).rejects.toThrow(ConflictException);
        });
    });

    // ============================================
    // GET /users - FindAll
    // ============================================
    describe('findAll', () => {
        it('should return an array of users', async () => {
            service.findAll.mockResolvedValue(mockUsersList);

            const result = await controller.findAll();

            expect(service.findAll).toHaveBeenCalled();
            expect(result).toEqual(mockUsersList);
            expect(result).toHaveLength(2);
        });

        it('should return empty array when no users', async () => {
            service.findAll.mockResolvedValue([]);

            const result = await controller.findAll();

            expect(result).toEqual([]);
        });
    });

    // ============================================
    // GET /users/:id - FindOne
    // ============================================
    describe('findOne', () => {
        it('should return a single user by id', async () => {
            service.findOne.mockResolvedValue(mockUser);

            const result = await controller.findOne(mockUser.id);

            expect(service.findOne).toHaveBeenCalledWith(mockUser.id);
            expect(result).toEqual(mockUser);
        });

        it('should propagate NotFoundException from service', async () => {
            service.findOne.mockRejectedValue(new NotFoundException('Không tìm thấy người dùng'));

            await expect(controller.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
        });
    });

    // ============================================
    // PATCH /users/:id - Update
    // ============================================
    describe('update', () => {
        const updateUserDto: UpdateUserDto = {
            username: 'updateduser',
        };

        it('should update a user', async () => {
            const updatedUser = { ...mockUser, username: 'updateduser' };
            service.update.mockResolvedValue(updatedUser);

            const result = await controller.update(mockUser.id, updateUserDto);

            expect(service.update).toHaveBeenCalledWith(mockUser.id, updateUserDto);
            expect(result.username).toBe('updateduser');
        });

        it('should propagate NotFoundException from service', async () => {
            service.update.mockRejectedValue(new NotFoundException('Không tìm thấy người dùng'));

            await expect(controller.update('nonexistent-id', updateUserDto)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should propagate ConflictException from service', async () => {
            const updatePhoneDto: UpdateUserDto = { phonenumber: '0907654321' };

            service.update.mockRejectedValue(
                new ConflictException('Số điện thoại đã được đăng ký'),
            );

            await expect(controller.update(mockUser.id, updatePhoneDto)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    // ============================================
    // DELETE /users/:id - Remove
    // ============================================
    describe('remove', () => {
        it('should remove a user', async () => {
            service.remove.mockResolvedValue(undefined);

            const result = await controller.remove(mockUser.id);

            expect(service.remove).toHaveBeenCalledWith(mockUser.id);
            expect(result).toBeUndefined();
        });

        it('should propagate NotFoundException from service', async () => {
            service.remove.mockRejectedValue(new NotFoundException('Không tìm thấy người dùng'));

            await expect(controller.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
        });
    });
});
