import { Test, TestingModule } from '@nestjs/testing';
import { UsersController, UserInfoController } from '../../src/users/users.controller.ts';
import { UsersService } from '../../src/users/users.service.ts';
import { ProfileService } from '../../src/users/profile.service.ts';
import { AccountService } from '../../src/users/account.service.ts';
import { BlockService } from '../../src/users/block.service.ts';
import { CreateUserDto } from '../../src/users/users.dto.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { saveUserUploadedImage } from '../../src/common/uploads/profile-upload.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { TokenGuard } from '../../src/common/guards/token.guard.ts';
import type { Request } from 'express';
import type { User } from '@prisma/client';

jest.mock('../../src/common/uploads/profile-upload.ts', () => ({
    PROFILE_USER_INFO_UPLOAD_OPTIONS: {
        limits: {
            fileSize: 5 * 1024 * 1024,
            files: 2,
        },
    },
    saveUserUploadedImage: jest.fn(),
}));

describe('UsersController', () => {
    let controller: UsersController;
    let service: UsersService;

    const mockUser = {
        id: 'user-1',
        phonenumber: '0123456789',
        username: 'testuser',
        role: UserRole.HV,
        status: UserStatus.ACTIVE,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: {
                        create: jest.fn().mockResolvedValue(mockUser),
                        findAll: jest.fn().mockResolvedValue([mockUser]),
                        findOne: jest.fn().mockResolvedValue(mockUser),
                        update: jest.fn().mockResolvedValue(mockUser),
                        remove: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
        service = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should create a user', async () => {
            const dto: CreateUserDto = {
                phonenumber: '0123456789',
                password: 'password',
                role: UserRole.HV,
                username: 'testu',
            };
            const result = await controller.create(dto);
            expect(result).toEqual(mockUser);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const createSpy = service.create;
            expect(createSpy).toHaveBeenCalledWith(dto);
        });
    });
});

describe('UserInfoController', () => {
    let controller: UserInfoController;
    let usersService: jest.Mocked<UsersService>;
    let profileService: jest.Mocked<ProfileService>;
    let mockedSaveUserUploadedImage: jest.MockedFunction<typeof saveUserUploadedImage>;

    const mockUser: User = {
        id: 'user-1',
        phonenumber: '0123456789',
        username: 'testuser',
        avatar: 'avatar-url',
        coverImage: 'cover-url',
        description: 'bio',
        role: UserRole.HV,
        token: 'token-1',
        height: null,
        status: UserStatus.ACTIVE,
        online: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        password: 'hash',
    };

    const buildRequest = (isMultipart: boolean): Request =>
        ({
            is: (value: string) => isMultipart && value === 'multipart/form-data',
        }) as Request;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockedSaveUserUploadedImage = jest.mocked(saveUserUploadedImage);

        const moduleRef = Test.createTestingModule({
            controllers: [UserInfoController],
            providers: [
                {
                    provide: UsersService,
                    useValue: {
                        findByToken: jest.fn(),
                    },
                },
                {
                    provide: ProfileService,
                    useValue: {
                        getUserInfo: jest.fn(),
                        setUserInfo: jest.fn(),
                    },
                },
                {
                    provide: AccountService,
                    useValue: {
                        changePassword: jest.fn(),
                        checkNewVersion: jest.fn(),
                    },
                },
                {
                    provide: BlockService,
                    useValue: {
                        setBlock: jest.fn(),
                    },
                },
            ],
        });

        const module: TestingModule = await moduleRef
            .overrideGuard(TokenGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<UserInfoController>(UserInfoController);
        usersService = module.get(UsersService);
        profileService = module.get(ProfileService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should reject non-multipart requests for set_user_info', async () => {
        const result = await controller.setUserInfo(buildRequest(false), {}, {});

        expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_TYPE);
    });

    it('should reject missing token for set_user_info', async () => {
        const result = await controller.setUserInfo(buildRequest(true), {}, {});

        expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
    });

    it('should upload avatar and cover_image files and return snake_case response', async () => {
        usersService.findByToken.mockResolvedValue(mockUser);
        mockedSaveUserUploadedImage
            .mockResolvedValueOnce('/uploads/users/avatar.png')
            .mockResolvedValueOnce('/uploads/users/cover.png');
        profileService.setUserInfo.mockResolvedValue({
            id: mockUser.id,
            username: mockUser.username,
            avatar: '/uploads/users/avatar.png',
            coverImage: '/uploads/users/cover.png',
            description: mockUser.description,
            online: '0',
            created: mockUser.createdAt.toISOString(),
        });

        const result = await controller.setUserInfo(
            buildRequest(true),
            {
                token: 'token-1',
                username: 'testuser',
            },
            {
                avatar: [
                    {
                        fieldname: 'avatar',
                        originalname: 'avatar.png',
                        mimetype: 'image/png',
                        size: 1024,
                        buffer: Buffer.from('avatar'),
                    },
                ],
                cover_image: [
                    {
                        fieldname: 'cover_image',
                        originalname: 'cover.png',
                        mimetype: 'image/png',
                        size: 2048,
                        buffer: Buffer.from('cover'),
                    },
                ],
            },
        );

        expect(profileService.setUserInfo.mock.calls[0]).toEqual([
            mockUser,
            {
                username: 'testuser',
                avatar: '/uploads/users/avatar.png',
                coverImage: '/uploads/users/cover.png',
            },
        ]);
        expect(result).toMatchObject({
            code: ResponseCode.OK,
            data: {
                id: mockUser.id,
                username: mockUser.username,
                avatar: '/uploads/users/avatar.png',
                cover_image: '/uploads/users/cover.png',
            },
        });
    });
});
