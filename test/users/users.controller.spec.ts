import { Test, TestingModule } from '@nestjs/testing';
import { UsersController, UserInfoController } from '../../src/users/users.controller.ts';
import { UsersService } from '../../src/users/users.service.ts';
import { CreateUserDto } from '../../src/users/users.dto.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { TokenGuard } from '../../src/common/guards/token.guard.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';

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

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserInfoController],
            providers: [
                {
                    provide: UsersService,
                    useValue: {
                        getUserInfo: jest.fn(),
                        setUserInfo: jest.fn(),
                        changePassword: jest.fn(),
                        setBlock: jest.fn(),
                        checkNewVersion: jest.fn(),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {},
                },
            ],
        })
            .overrideGuard(TokenGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<UserInfoController>(UserInfoController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
