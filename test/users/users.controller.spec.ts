import { Test, TestingModule } from '@nestjs/testing';
import { UsersController, UserInfoController } from '../../src/users/users.controller.ts';
import { UsersService } from '../../src/users/users.service.ts';
import { ProfileService } from '../../src/users/profile.service.ts';
import { AccountService } from '../../src/users/account.service.ts';
import { BlockService } from '../../src/users/block.service.ts';
import { CreateUserDto, GetUserInfoDto } from '../../src/users/users.dto.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { TokenGuard } from '../../src/common/guards/token.guard.ts';
import { User } from '@prisma/client';

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
        it('should create a user and return wrapped response', async () => {
            const dto: CreateUserDto = {
                phonenumber: '0123456789',
                password: 'password',
                role: UserRole.HV,
                username: 'testu',
            };
            const result = await controller.create(dto);
            expect(result).toEqual({
                code: '1000',
                message: 'OK',
                data: mockUser,
            });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const createSpy = service.create;
            expect(createSpy).toHaveBeenCalledWith(dto);
        });
    });
});

describe('UserInfoController', () => {
    let controller: UserInfoController;
    let profileService: ProfileService;

    const mockUser = { id: 'user-1' } as User;
    const mockProfile = { id: 'user-1', username: 'test' };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserInfoController],
            providers: [
                {
                    provide: ProfileService,
                    useValue: {
                        getUserInfo: jest.fn().mockResolvedValue(mockProfile),
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
                        getListBlocks: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(TokenGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<UserInfoController>(UserInfoController);
        profileService = module.get<ProfileService>(ProfileService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getUserInfo', () => {
        it('should return wrapped profile info', async () => {
            const dto: GetUserInfoDto = { userId: 'user-1' };
            const result = await controller.getUserInfo(dto, mockUser);
            expect(result).toEqual({
                code: '1000',
                message: 'OK',
                data: mockProfile,
            });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(profileService.getUserInfo).toHaveBeenCalledWith(mockUser, 'user-1');
        });
    });
});
