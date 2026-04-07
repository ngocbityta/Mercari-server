import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service.ts';
import { UsersService } from '../../src/users/users.service.ts';
import { TokenService } from '../../src/auth/token.service.ts';
import { VerificationService } from '../../src/auth/verification.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { UserStatus, UserRole } from '@prisma/client';

const mockUser = {
    id: 'user-1',
    phonenumber: '0901234567',
    password: 'password123',
    username: 'user1',
    avatar: null,
    coverImage: null,
    description: null,
    role: UserRole.HV,
    token: null,
    height: null,
    status: UserStatus.ACTIVE,
    online: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('AuthService', () => {
    let service: AuthService;
    let usersService: jest.Mocked<UsersService>;
    let verificationService: jest.Mocked<VerificationService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: {
                        findByPhonenumber: jest.fn(),
                        updateToken: jest.fn(),
                    },
                },
                {
                    provide: TokenService,
                    useValue: {
                        generateToken: jest.fn().mockReturnValue('mock-token'),
                    },
                },
                {
                    provide: VerificationService,
                    useValue: {
                        validateCode: jest.fn(),
                        deleteCodes: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        usersService = module.get(UsersService);
        verificationService = module.get(VerificationService);
    });

    describe('checkVerifyCode', () => {
        it('should return 9993 when code is incorrect', async () => {
            usersService.findByPhonenumber.mockResolvedValue(mockUser);
            verificationService.validateCode.mockResolvedValue(false);

            const result = await service.checkVerifyCode({
                phonenumber: '0901234567',
                codeVerify: 'WRONG',
            });

            expect(result.code).toBe(ResponseCode.CODE_VERIFY_INCORRECT);
            expect(result.code).toBe('9993');
        });

        it('should return OK (1000) when code is correct', async () => {
            usersService.findByPhonenumber.mockResolvedValue(mockUser);
            verificationService.validateCode.mockResolvedValue(true);

            const result = await service.checkVerifyCode({
                phonenumber: '0901234567',
                codeVerify: 'CORRECT',
            });

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toHaveProperty('token', 'mock-token');
        });
    });
});
