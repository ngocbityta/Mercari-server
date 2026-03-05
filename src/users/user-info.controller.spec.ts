import { Test, TestingModule } from '@nestjs/testing';
import { UserInfoController } from './users.controller.ts';
import { UsersService } from './users.service.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';
import { User } from '../entities/user.entity.ts';
import { ResponseCode } from '../common/enums/response-code.enum.ts';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TokenGuard } from '../common/guards/token.guard.ts';

const mockUser: User = {
    id: 'user-a',
    phonenumber: '0123456789',
    password: 'hash',
    username: 'userA',
    avatar: null,
    cover_image: null,
    description: null,
    role: UserRole.HV,
    token: 'tok-a',
    status: UserStatus.ACTIVE,
    online: false,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockUsersService = {
    getUserInfo: jest.fn(),
    setUserInfo: jest.fn(),
};

describe('UserInfoController', () => {
    let controller: UserInfoController;
    let service: typeof mockUsersService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserInfoController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        })
            .overrideGuard(TokenGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<UserInfoController>(UserInfoController);
        service = module.get(UsersService);
    });

    describe('getUserInfo', () => {
        it('should return user info ok', async () => {
            const data = { id: 'x', username: 'info' };
            service.getUserInfo.mockResolvedValue(data);

            const result = await controller.getUserInfo({ token: 'tok', user_id: 'x' }, mockUser);
            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual(data);
        });

        it('should return NO_DATA if user not found', async () => {
            service.getUserInfo.mockRejectedValue(new NotFoundException('User not found'));
            const result = await controller.getUserInfo(
                { token: 'tok', user_id: 'bad-id' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.NO_DATA);
        });
    });

    describe('setUserInfo', () => {
        it('should return set user info ok', async () => {
            const data = { id: 'x', username: 'newname' };
            service.setUserInfo.mockResolvedValue(data);

            const result = await controller.setUserInfo(
                { token: 'tok', username: 'newname' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual(data);
        });

        it('should return parameter error if username is invalid', async () => {
            service.setUserInfo.mockRejectedValue(new BadRequestException('Invalid username'));
            const result = await controller.setUserInfo({ token: 'tok', username: '  ' }, mockUser);
            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect(result.message).toBe('Invalid username');
        });
    });
});
