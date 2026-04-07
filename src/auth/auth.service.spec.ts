import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.ts';
import { UserRole, UserStatus } from '@prisma/client';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum.ts';

import { TokenService } from './token.service.ts';
import { UsersService } from '../users/users.service.ts';
import { VerificationService } from './verification.service.ts';

describe('AuthService', () => {
    let service: AuthService;

    const mockUsersService = {
        findByPhonenumber: jest.fn(),
        create: jest.fn(),
        updateToken: jest.fn(),
        findByToken: jest.fn(),
        update: jest.fn(),
    };

    const mockTokenService = {
        generateToken: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000000'),
    };

    const mockVerificationService = {
        generateAndStoreCode: jest.fn(),
        getRecentCode: jest.fn(),
        validateCode: jest.fn(),
        deleteCodes: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: mockUsersService },
                { provide: TokenService, useValue: mockTokenService },
                { provide: VerificationService, useValue: mockVerificationService },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);

        // Reset mocks
        jest.clearAllMocks();
    });

    // ==============================================================
    // SIGNUP TEST CASES
    // ==============================================================
    describe('signup', () => {
        const validSignupDto = {
            phonenumber: '0912345678',
            password: 'abc123',
            role: UserRole.HV,
        };

        it('TC1: Đăng ký thành công với SĐT mới, mật khẩu hợp lệ, có role', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue(null);
            mockUsersService.create.mockResolvedValue({ id: 'user-1' });
            mockVerificationService.generateAndStoreCode.mockResolvedValue('ABC123');
            mockVerificationService.deleteCodes.mockResolvedValue({ count: 0 });

            const result = await service.signup(validSignupDto);

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.message).toBe(ResponseMessage[ResponseCode.OK]);
            expect(result.data).toHaveProperty('verifyCode');
            expect((result.data as { verifyCode: string }).verifyCode).toBe('ABC123');
            expect(mockUsersService.create).toHaveBeenCalledWith({
                phonenumber: '0912345678',
                password: 'abc123',
                role: UserRole.HV,
            });
        });

        it('TC2: SĐT đã đăng ký → 9996 User existed', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue({
                id: 'existing-user',
                phonenumber: '0912345678',
            });

            const result = await service.signup(validSignupDto);

            expect(result.code).toBe(ResponseCode.USER_EXISTED);
            expect(result.message).toBe('User existed');
        });

        it('TC8: Mật khẩu trùng SĐT → 1004', async () => {
            const result = await service.signup({
                phonenumber: '0912345678',
                password: '0912345678',
                role: UserRole.HV,
            });

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect(result.message).toContain('trùng');
        });

        it('TC1-GV: Đăng ký thành công với role GV', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue(null);
            mockUsersService.create.mockResolvedValue({ id: 'user-2' });
            mockVerificationService.generateAndStoreCode.mockResolvedValue('XYZ789');

            const result = await service.signup({
                ...validSignupDto,
                role: UserRole.GV,
            });

            expect(result.code).toBe(ResponseCode.OK);
            expect(mockUsersService.create).toHaveBeenCalledWith({
                phonenumber: '0912345678',
                password: 'abc123',
                role: UserRole.GV,
            });
        });
    });

    // ==============================================================
    // LOGIN TEST CASES
    // ==============================================================
    describe('login', () => {
        const validLoginDto = {
            phonenumber: '0912345678',
            password: 'abc123',
            devtoken: 'device-token-123',
        };

        const mockUser = {
            id: 'user-1',
            phonenumber: '0912345678',
            password: 'abc123',
            username: 'TestUser',
            avatar: 'avatar.png',
            role: UserRole.HV,
            status: UserStatus.ACTIVE,
            token: null,
            online: false,
        };

        it('TC1: Đăng nhập thành công', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue(mockUser);
            mockUsersService.updateToken.mockResolvedValue({});

            const result = await service.login(validLoginDto);

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual({
                id: 'user-1',
                username: 'TestUser',
                token: '00000000-0000-0000-0000-000000000000',
                avatar: 'avatar.png',
                role: UserRole.HV,
            });
        });

        it('TC2: SĐT chưa đăng ký → 9995', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue(null);

            const result = await service.login(validLoginDto);

            expect(result.code).toBe(ResponseCode.USER_NOT_VALIDATED);
        });

        it('TC6: Mật khẩu trùng SĐT → 1004', async () => {
            const result = await service.login({
                phonenumber: '0912345678',
                password: '0912345678',
                devtoken: 'device-token',
            });

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });

        it('TC7: Đúng SĐT nhưng sai mật khẩu → 1004', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue(mockUser);

            const result = await service.login({
                ...validLoginDto,
                password: 'wrong1',
            });

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect(result.message).toContain('không chính xác');
        });

        it('TC8: Đăng nhập lần 2 → token cũ bị thay thế', async () => {
            const userWithToken = { ...mockUser, token: 'old-token-12345678-1234-1234-1234567' };
            mockUsersService.findByPhonenumber.mockResolvedValue(userWithToken);
            mockUsersService.updateToken.mockResolvedValue({});

            const result = await service.login(validLoginDto);

            expect(result.code).toBe(ResponseCode.OK);
            expect((result.data as { token: string }).token).toBe(
                '00000000-0000-0000-0000-000000000000',
            );
            expect(mockUsersService.updateToken).toHaveBeenCalledWith(
                'user-1',
                '00000000-0000-0000-0000-000000000000',
                true,
            );
        });

        it('Tài khoản bị khóa → 9991', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue({
                ...mockUser,
                status: UserStatus.LOCKED,
            });

            const result = await service.login(validLoginDto);

            expect(result.code).toBe(ResponseCode.ACCOUNT_LOCKED);
        });
    });

    // ==============================================================
    // LOGOUT TEST CASES
    // ==============================================================
    describe('logout', () => {
        it('TC1: Token hợp lệ → đăng xuất thành công', async () => {
            mockUsersService.findByToken.mockResolvedValue({
                id: 'user-1',
                token: '12345678-1234-1234-1234-123456789012',
            });
            mockUsersService.updateToken.mockResolvedValue({});

            const result = await service.logout('12345678-1234-1234-1234-123456789012');

            expect(result.code).toBe(ResponseCode.OK);
            expect(mockUsersService.updateToken).toHaveBeenCalledWith('user-1', null, false);
        });

        it('TC2: Token không hợp lệ → 9998', async () => {
            mockUsersService.findByToken.mockResolvedValue(null);

            const result = await service.logout('missing-or-invalid-token-1234567890');

            expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
        });
    });

    // ==============================================================
    // GET VERIFY CODE TEST CASES
    // ==============================================================
    describe('getVerifyCode', () => {
        it('TC1: SĐT đã signup chưa verify → trả về verify code', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue({
                id: 'user-1',
                phonenumber: '0912345678',
                token: null,
            });
            mockVerificationService.getRecentCode.mockResolvedValue(null);
            mockVerificationService.generateAndStoreCode.mockResolvedValue('ABC123');

            const result = await service.getVerifyCode('0912345678');

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toHaveProperty('verifyCode');
        });

        it('TC2: Gửi lại trong < 120s → trả về mã cũ', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue({
                id: 'user-1',
                token: null,
            });
            mockVerificationService.getRecentCode.mockResolvedValue({
                code: 'ABC123',
                createdAt: new Date(), // vừa tạo
            });

            const result = await service.getVerifyCode('0912345678');

            expect(result.code).toBe(ResponseCode.OK);
            expect((result.data as { verifyCode: string }).verifyCode).toBe('ABC123');
        });

        it('TC3: SĐT đã verify xong (có token) → 1010', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue({
                id: 'user-1',
                token: 'active-token-12345678-1234-12345678',
            });

            const result = await service.getVerifyCode('0912345678');

            expect(result.code).toBe(ResponseCode.ACTION_DONE_PREVIOUSLY);
        });

        it('TC4: SĐT chưa đăng ký → 9995', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue(null);

            const result = await service.getVerifyCode('0912345678');

            expect(result.code).toBe(ResponseCode.USER_NOT_VALIDATED);
        });
    });

    // ==============================================================
    // CHECK VERIFY CODE TEST CASES
    // ==============================================================
    describe('checkVerifyCode', () => {
        it('TC1: SĐT + mã xác thực đúng → 1000 OK', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue({
                id: 'user-1',
                phonenumber: '0912345678',
                token: null,
            });
            mockVerificationService.validateCode.mockResolvedValue(true);
            mockVerificationService.deleteCodes.mockResolvedValue({ count: 1 });
            mockUsersService.updateToken.mockResolvedValue({});

            const result = await service.checkVerifyCode({
                phonenumber: '0912345678',
                codeVerify: 'ABC123',
            });

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toHaveProperty('id');
            expect(result.data).toHaveProperty('token');
        });

        it('TC3: SĐT không có trong danh sách → 9995', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue(null);

            const result = await service.checkVerifyCode({
                phonenumber: '0999999999',
                codeVerify: 'ABC123',
            });

            expect(result.code).toBe(ResponseCode.USER_NOT_VALIDATED);
        });

        it('TC4: SĐT đã verify trước đó (có token) → 9996', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue({
                id: 'user-1',
                token: 'existing-token-12345678-1234-123456',
            });

            const result = await service.checkVerifyCode({
                phonenumber: '0912345678',
                codeVerify: 'ABC123',
            });

            expect(result.code).toBe(ResponseCode.USER_EXISTED);
        });

        it('TC5: Đúng SĐT + sai mã xác thực → 1004', async () => {
            mockUsersService.findByPhonenumber.mockResolvedValue({
                id: 'user-1',
                token: null,
            });
            mockVerificationService.validateCode.mockResolvedValue(false);

            const result = await service.checkVerifyCode({
                phonenumber: '0912345678',
                codeVerify: 'WRONG1',
            });

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });
    });

    // ==============================================================
    // CHANGE INFO AFTER SIGNUP TEST CASES
    // ==============================================================
    describe('changeInfoAfterSignup', () => {
        const mockUser = {
            id: 'user-1',
            phonenumber: '0912345678',
            username: null,
            avatar: null,
            token: '12345678-1234-1234-1234-123456789012',
            createdAt: new Date('2026-01-01'),
        };

        it('TC1: Token hợp lệ + thông tin đúng → 1000 OK', async () => {
            mockUsersService.findByToken.mockResolvedValue(mockUser);
            mockUsersService.update.mockResolvedValue({
                ...mockUser,
                username: 'NewUser',
                avatar: 'new-avatar.png',
            });

            const result = await service.changeInfoAfterSignup({
                token: '12345678-1234-1234-1234-123456789012',
                username: 'NewUser',
                avatar: 'new-avatar.png',
            });

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual({
                id: 'user-1',
                username: 'NewUser',
                phonenumber: '0912345678',
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                created: expect.any(String),
                avatar: 'new-avatar.png',
            });
        });

        it('TC2: Token không hợp lệ → 9998', async () => {
            mockUsersService.findByToken.mockResolvedValue(null);

            const result = await service.changeInfoAfterSignup({
                token: 'missing-or-invalid-token-1234567890',
                username: 'NewUser',
            });

            expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
        });

        it('TC4: Username trùng SĐT → 1004', async () => {
            mockUsersService.findByToken.mockResolvedValue(mockUser);

            const result = await service.changeInfoAfterSignup({
                token: '12345678-1234-1234-1234-123456789012',
                username: '0912345678',
            });

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });
    });
});
