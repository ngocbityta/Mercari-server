import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service.ts';
import { UsersService } from '../../src/users/users.service.ts';
import { TokenService } from '../../src/auth/token.service.ts';
import { VerificationService } from '../../src/auth/verification.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { UserStatus, UserRole } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';

const mockUser = {
    id: 'user-1',
    phonenumber: '0901234567',
    password: 'password123',
    username: 'user1',
    avatar: 'avatar.jpg',
    coverImage: null,
    description: null,
    role: UserRole.HV,
    token: 'mock-token',
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
                        findByToken: jest.fn(),
                        updateToken: jest.fn(),
                        create: jest.fn(),
                        update: jest.fn(),
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
                        generateAndStoreCode: jest.fn(),
                        getRecentCode: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        usersService = module.get(UsersService);
        verificationService = module.get(VerificationService);
    });

    describe('signup', () => {
        it('should throw INVALID_PARAMETER_VALUE if password equals phonenumber', async () => {
            const call = () =>
                service.signup({
                    phonenumber: '0901234567',
                    password: '0901234567',
                    role: UserRole.HV,
                });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('should throw USER_EXISTED if user already exists', async () => {
            usersService.findByPhonenumber.mockResolvedValue(mockUser);
            const call = () =>
                service.signup({
                    phonenumber: '0901234567',
                    password: 'password123',
                    role: UserRole.HV,
                });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.USER_EXISTED);
            }
        });

        it('should return verifyCode on success', async () => {
            usersService.findByPhonenumber.mockResolvedValue(null);
            verificationService.generateAndStoreCode.mockResolvedValue('123456');
            const result = await service.signup({
                phonenumber: '0901234567',
                password: 'password123',
                role: UserRole.HV,
            });
            expect(result).toEqual({ verifyCode: '123456' });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(usersService.create).toHaveBeenCalled();
        });
    });

    describe('login', () => {
        it('should throw USER_NOT_VALIDATED if user not found', async () => {
            usersService.findByPhonenumber.mockResolvedValue(null);
            const call = () =>
                service.login({ phonenumber: '0901234567', password: 'password123' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.USER_NOT_VALIDATED);
            }
        });

        it('should throw ACCOUNT_LOCKED if user status is LOCKED', async () => {
            usersService.findByPhonenumber.mockResolvedValue({
                ...mockUser,
                status: UserStatus.LOCKED,
            });
            const call = () =>
                service.login({ phonenumber: '0901234567', password: 'password123' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
            }
        });

        it('should throw INVALID_PARAMETER_VALUE if password incorrect', async () => {
            usersService.findByPhonenumber.mockResolvedValue(mockUser);
            const call = () => service.login({ phonenumber: '0901234567', password: 'wrong' });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('should return user info and token on success', async () => {
            usersService.findByPhonenumber.mockResolvedValue(mockUser);
            const result = await service.login({
                phonenumber: '0901234567',
                password: 'password123',
            });
            expect(result).toEqual({
                id: mockUser.id,
                username: mockUser.username,
                token: 'mock-token',
                avatar: mockUser.avatar,
                role: mockUser.role,
            });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(usersService.updateToken).toHaveBeenCalledWith(mockUser.id, 'mock-token', true);
        });
    });

    describe('logout', () => {
        it('should throw TOKEN_INVALID if token not found', async () => {
            usersService.findByToken.mockResolvedValue(null);
            const call = () => service.logout('invalid');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
            }
        });

        it('should return empty object on success', async () => {
            usersService.findByToken.mockResolvedValue(mockUser);
            const result = await service.logout('mock-token');
            expect(result).toEqual({});
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(usersService.updateToken).toHaveBeenCalledWith(mockUser.id, null, false);
        });
    });

    describe('getVerifyCode', () => {
        it('should throw USER_NOT_VALIDATED if user not found', async () => {
            usersService.findByPhonenumber.mockResolvedValue(null);
            const call = () => service.getVerifyCode('0901234567');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.USER_NOT_VALIDATED);
            }
        });

        it('should throw ACTION_DONE_PREVIOUSLY if user already has a token', async () => {
            usersService.findByPhonenumber.mockResolvedValue(mockUser);
            const call = () => service.getVerifyCode('0901234567');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.ACTION_DONE_PREVIOUSLY);
            }
        });

        it('should return recent code if still valid', async () => {
            usersService.findByPhonenumber.mockResolvedValue({ ...mockUser, token: null });
            verificationService.getRecentCode.mockResolvedValue({
                id: 'code-1',
                phonenumber: '0901234567',
                code: '123456',
                createdAt: new Date(),
            });
            const result = await service.getVerifyCode('0901234567');
            expect(result).toEqual({ verifyCode: '123456' });
        });

        it('should return new code if no recent code', async () => {
            usersService.findByPhonenumber.mockResolvedValue({ ...mockUser, token: null });
            verificationService.getRecentCode.mockResolvedValue(null);
            verificationService.generateAndStoreCode.mockResolvedValue('654321');
            const result = await service.getVerifyCode('0901234567');
            expect(result).toEqual({ verifyCode: '654321' });
        });
    });

    describe('checkVerifyCode', () => {
        it('should throw CODE_VERIFY_INCORRECT when code is incorrect', async () => {
            usersService.findByPhonenumber.mockResolvedValue({ ...mockUser, token: null });
            verificationService.validateCode.mockResolvedValue(false);

            const call = () =>
                service.checkVerifyCode({
                    phonenumber: '0901234567',
                    codeVerify: 'WRONG',
                });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.CODE_VERIFY_INCORRECT);
            }
        });

        it('should return token when code is correct', async () => {
            usersService.findByPhonenumber.mockResolvedValue({ ...mockUser, token: null });
            verificationService.validateCode.mockResolvedValue(true);

            const result = await service.checkVerifyCode({
                phonenumber: '0901234567',
                codeVerify: 'CORRECT',
            });

            expect(result).toEqual({ id: mockUser.id, token: 'mock-token' });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(usersService.updateToken).toHaveBeenCalledWith(mockUser.id, 'mock-token');
        });
    });

    describe('changeInfoAfterSignup', () => {
        it('should throw TOKEN_INVALID if token invalid', async () => {
            usersService.findByToken.mockResolvedValue(null);
            const call = () =>
                service.changeInfoAfterSignup({
                    token: 'invalid',
                    username: 'new',
                    avatar: 'new.jpg',
                });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
            }
        });

        it('should throw INVALID_PARAMETER_VALUE if username equals phonenumber', async () => {
            usersService.findByToken.mockResolvedValue(mockUser);
            const call = () =>
                service.changeInfoAfterSignup({
                    token: 'mock-token',
                    username: mockUser.phonenumber,
                    avatar: 'new.jpg',
                });
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('should return updated user info on success', async () => {
            usersService.findByToken.mockResolvedValue(mockUser);
            usersService.update.mockResolvedValue({
                ...mockUser,
                username: 'new',
                avatar: 'new.jpg',
            });
            const result = await service.changeInfoAfterSignup({
                token: 'mock-token',
                username: 'new',
                avatar: 'new.jpg',
            });
            expect(result).toEqual({
                id: mockUser.id,
                username: 'new',
                phonenumber: mockUser.phonenumber,
                created: mockUser.createdAt.toISOString(),
                avatar: 'new.jpg',
            });
        });
    });
});
