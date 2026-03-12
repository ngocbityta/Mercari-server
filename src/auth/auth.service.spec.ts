import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { UserRole, UserStatus } from '@prisma/client';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum.ts';

import { TokenService } from './token.service.ts';

describe('AuthService', () => {
    let service: AuthService;

    const mockPrismaService = {
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        verifyCode: {
            findFirst: jest.fn(),
            create: jest.fn(),
            deleteMany: jest.fn(),
        },
    };

    const mockTokenService = {
        generateToken: jest.fn().mockReturnValue('mock-uuid-token'),
        generateVerifyCode: jest.fn().mockReturnValue('ABC123'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: TokenService, useValue: mockTokenService },
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
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            mockPrismaService.user.create.mockResolvedValue({ id: 'user-1' });
            mockPrismaService.verifyCode.deleteMany.mockResolvedValue({ count: 0 });
            mockPrismaService.verifyCode.create.mockResolvedValue({});

            const result = await service.signup(validSignupDto);

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.message).toBe(ResponseMessage[ResponseCode.OK]);
            expect(result.data).toHaveProperty('verify_code');
            expect((result.data as { verify_code: string }).verify_code).toHaveLength(6);
            expect(mockPrismaService.user.create).toHaveBeenCalledWith({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data: expect.objectContaining({
                    phonenumber: '0912345678',
                    password: 'abc123',
                    role: UserRole.HV,
                }),
            });
        });

        it('TC2: SĐT đã đăng ký → 9996 User existed', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({
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
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            mockPrismaService.user.create.mockResolvedValue({ id: 'user-2' });
            mockPrismaService.verifyCode.deleteMany.mockResolvedValue({ count: 0 });
            mockPrismaService.verifyCode.create.mockResolvedValue({});

            const result = await service.signup({
                ...validSignupDto,
                role: UserRole.GV,
            });

            expect(result.code).toBe(ResponseCode.OK);
            expect(mockPrismaService.user.create).toHaveBeenCalledWith({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data: expect.objectContaining({ role: UserRole.GV }),
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
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            mockPrismaService.user.update.mockResolvedValue({
                ...mockUser,
                token: 'mock-uuid-token',
            });

            const result = await service.login(validLoginDto);

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual({
                id: 'user-1',
                username: 'TestUser',
                token: 'mock-uuid-token',
                avatar: 'avatar.png',
                role: UserRole.HV,
            });
        });

        it('TC2: SĐT chưa đăng ký → 9995', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

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
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.login({
                ...validLoginDto,
                password: 'wrong1',
            });

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect(result.message).toContain('không chính xác');
        });

        it('TC8: Đăng nhập lần 2 → token cũ bị thay thế', async () => {
            const userWithToken = { ...mockUser, token: 'old-token' };
            mockPrismaService.user.findUnique.mockResolvedValue(userWithToken);
            mockPrismaService.user.update.mockResolvedValue({
                ...userWithToken,
                token: 'mock-uuid-token',
            });

            const result = await service.login(validLoginDto);

            expect(result.code).toBe(ResponseCode.OK);
            expect((result.data as { token: string }).token).toBe('mock-uuid-token');
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { token: 'mock-uuid-token', online: true },
            });
        });

        it('Tài khoản bị khóa → 9991', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({
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
            mockPrismaService.user.findFirst.mockResolvedValue({
                id: 'user-1',
                token: 'valid-token',
            });
            mockPrismaService.user.update.mockResolvedValue({});

            const result = await service.logout('valid-token');

            expect(result.code).toBe(ResponseCode.OK);
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { token: null, online: false },
            });
        });

        it('TC2: Token không hợp lệ → 9998', async () => {
            mockPrismaService.user.findFirst.mockResolvedValue(null);

            const result = await service.logout('invalid-token');

            expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
        });
    });

    // ==============================================================
    // GET VERIFY CODE TEST CASES
    // ==============================================================
    describe('getVerifyCode', () => {
        it('TC1: SĐT đã signup chưa verify → trả về verify code', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({
                id: 'user-1',
                phonenumber: '0912345678',
                token: null,
            });
            mockPrismaService.verifyCode.findFirst.mockResolvedValue(null);
            mockPrismaService.verifyCode.deleteMany.mockResolvedValue({ count: 0 });
            mockPrismaService.verifyCode.create.mockResolvedValue({});

            const result = await service.getVerifyCode('0912345678');

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toHaveProperty('verify_code');
        });

        it('TC2: Gửi lại trong < 120s → trả về mã cũ', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({
                id: 'user-1',
                token: null,
            });
            mockPrismaService.verifyCode.findFirst.mockResolvedValue({
                code: 'ABC123',
                createdAt: new Date(), // vừa tạo
            });

            const result = await service.getVerifyCode('0912345678');

            expect(result.code).toBe(ResponseCode.OK);
            expect((result.data as { verify_code: string }).verify_code).toBe('ABC123');
        });

        it('TC3: SĐT đã verify xong (có token) → 1010', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({
                id: 'user-1',
                token: 'active-token',
            });

            const result = await service.getVerifyCode('0912345678');

            expect(result.code).toBe(ResponseCode.ACTION_NOT_VALID);
        });

        it('TC4: SĐT chưa đăng ký → 9995', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            const result = await service.getVerifyCode('0912345678');

            expect(result.code).toBe(ResponseCode.USER_NOT_VALIDATED);
        });
    });

    // ==============================================================
    // CHECK VERIFY CODE TEST CASES
    // ==============================================================
    describe('checkVerifyCode', () => {
        it('TC1: SĐT + mã xác thực đúng → 1000 OK', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({
                id: 'user-1',
                phonenumber: '0912345678',
                token: null,
            });
            mockPrismaService.verifyCode.findFirst.mockResolvedValue({
                code: 'ABC123',
                phonenumber: '0912345678',
            });
            mockPrismaService.verifyCode.deleteMany.mockResolvedValue({ count: 1 });
            mockPrismaService.user.update.mockResolvedValue({});

            const result = await service.checkVerifyCode({
                phonenumber: '0912345678',
                code_verify: 'ABC123',
            });

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toHaveProperty('id');
            expect(result.data).toHaveProperty('token');
        });

        it('TC3: SĐT không có trong danh sách → 9995', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            const result = await service.checkVerifyCode({
                phonenumber: '0999999999',
                code_verify: 'ABC123',
            });

            expect(result.code).toBe(ResponseCode.USER_NOT_VALIDATED);
        });

        it('TC4: SĐT đã verify trước đó (có token) → 9996', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({
                id: 'user-1',
                token: 'existing-token',
            });

            const result = await service.checkVerifyCode({
                phonenumber: '0912345678',
                code_verify: 'ABC123',
            });

            expect(result.code).toBe(ResponseCode.USER_EXISTED);
        });

        it('TC5: Đúng SĐT + sai mã xác thực → 9993', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({
                id: 'user-1',
                token: null,
            });
            mockPrismaService.verifyCode.findFirst.mockResolvedValue({
                code: 'ABC123',
                phonenumber: '0912345678',
            });

            const result = await service.checkVerifyCode({
                phonenumber: '0912345678',
                code_verify: 'WRONG1',
            });

            expect(result.code).toBe(ResponseCode.CODE_VERIFY_INCORRECT);
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
            token: 'valid-token',
            createdAt: new Date('2026-01-01'),
        };

        it('TC1: Token hợp lệ + thông tin đúng → 1000 OK', async () => {
            mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
            mockPrismaService.user.update.mockResolvedValue({
                ...mockUser,
                username: 'NewUser',
                avatar: 'new-avatar.png',
            });

            const result = await service.changeInfoAfterSignup({
                token: 'valid-token',
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
            mockPrismaService.user.findFirst.mockResolvedValue(null);

            const result = await service.changeInfoAfterSignup({
                token: 'invalid-token',
                username: 'NewUser',
            });

            expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
        });

        it('TC4: Username trùng SĐT → 1004', async () => {
            mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

            const result = await service.changeInfoAfterSignup({
                token: 'valid-token',
                username: '0912345678',
            });

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });
    });
});
