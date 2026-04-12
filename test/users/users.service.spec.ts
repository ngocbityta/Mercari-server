import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../../src/users/users.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { CreateUserDto, UpdateUserDto } from '../../src/users/users.dto.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { User } from '@prisma/client';

// Mock user data
const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phonenumber: '0901234567',
    password: 'hashedPassword123',
    username: 'testuser',
    avatar: null,
    coverImage: null,
    description: null,
    role: UserRole.HV,
    token: null,
    height: null,
    status: UserStatus.ACTIVE,
    online: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
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

// Mock Prisma service
const mockPrisma = {
    user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    block: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
    },
};

describe('UsersService', () => {
    let service: UsersService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        prisma = module.get(PrismaService);
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
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue(mockUser);

            const result = await service.create(createUserDto);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { phonenumber: createUserDto.phonenumber },
            });
            expect(prisma.user.create).toHaveBeenCalled();
            expect(result).toEqual(mockUser);
        });

        it('should throw ConflictException if phonenumber already exists', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
            expect(prisma.user.create).not.toHaveBeenCalled();
        });
    });

    describe('findAll', () => {
        it('should return an array of users', async () => {
            prisma.user.findMany.mockResolvedValue(mockUsersList);

            const result = await service.findAll();

            expect(prisma.user.findMany).toHaveBeenCalled();
            expect(result).toEqual(mockUsersList);
        });
    });

    describe('findOne', () => {
        it('should return a user by id', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findOne(mockUser.id);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: mockUser.id },
            });
            expect(result).toEqual(mockUser);
        });

        it('should throw NotFoundException if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
        });
    });

    describe('update', () => {
        const updateUserDto: UpdateUserDto = {
            username: 'updateduser',
        };

        it('should update a user successfully', async () => {
            const updatedUser = { ...mockUser, username: 'updateduser' };

            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.update(mockUser.id, updateUserDto);

            expect(prisma.user.update).toHaveBeenCalled();
            expect(result.username).toBe('updateduser');
        });
    });

    describe('remove', () => {
        it('should remove a user successfully', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.delete.mockResolvedValue(mockUser);

            await service.remove(mockUser.id);

            expect(prisma.user.delete).toHaveBeenCalledWith({
                where: { id: mockUser.id },
            });
        });
    });
});
