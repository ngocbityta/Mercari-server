import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.ts';
import { AuthService } from './auth.service.ts';
import { UserRole } from '@prisma/client';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum.ts';

describe('AuthController', () => {
    let controller: AuthController;

    const mockAuthService = {
        signup: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        getVerifyCode: jest.fn(),
        checkVerifyCode: jest.fn(),
        changeInfoAfterSignup: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [{ provide: AuthService, useValue: mockAuthService }],
        }).compile();

        controller = module.get<AuthController>(AuthController);

        jest.clearAllMocks();
    });

    describe('signup', () => {
        it('should call authService.signup with correct dto', async () => {
            const dto = { phonenumber: '0912345678', password: 'abc123', role: UserRole.HV };
            const expectedResult = {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: { verifyCode: 'ABC123' },
            };
            mockAuthService.signup.mockResolvedValue(expectedResult);

            const result = await controller.signup(dto);

            expect(mockAuthService.signup).toHaveBeenCalledWith(dto);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('login', () => {
        it('should call authService.login with correct dto', async () => {
            const dto = { phonenumber: '0912345678', password: 'abc123', devtoken: 'dev-123' };
            const expectedResult = {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: { id: '1', username: 'User', token: 'tok', avatar: '', role: UserRole.HV },
            };
            mockAuthService.login.mockResolvedValue(expectedResult);

            const result = await controller.login(dto);

            expect(mockAuthService.login).toHaveBeenCalledWith(dto);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('logout', () => {
        it('should call authService.logout with token', async () => {
            const dto = { token: 'valid-token' };
            const expectedResult = {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
            };
            mockAuthService.logout.mockResolvedValue(expectedResult);

            const result = await controller.logout(dto);

            expect(mockAuthService.logout).toHaveBeenCalledWith('valid-token');
            expect(result).toEqual(expectedResult);
        });
    });

    describe('getVerifyCode', () => {
        it('should call authService.getVerifyCode with phonenumber', async () => {
            const dto = { phonenumber: '0912345678' };
            const expectedResult = {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: { verifyCode: 'XYZ789' },
            };
            mockAuthService.getVerifyCode.mockResolvedValue(expectedResult);

            const result = await controller.getVerifyCode(dto);

            expect(mockAuthService.getVerifyCode).toHaveBeenCalledWith('0912345678');
            expect(result).toEqual(expectedResult);
        });
    });

    describe('checkVerifyCode', () => {
        it('should call authService.checkVerifyCode with correct dto', async () => {
            const dto = { phonenumber: '0912345678', codeVerify: 'ABC123' };
            const expectedResult = {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: { id: '1', token: 'tok' },
            };
            mockAuthService.checkVerifyCode.mockResolvedValue(expectedResult);

            const result = await controller.checkVerifyCode(dto);

            expect(mockAuthService.checkVerifyCode).toHaveBeenCalledWith(dto);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('changeInfoAfterSignup', () => {
        it('should call authService.changeInfoAfterSignup with correct dto', async () => {
            const dto = { token: 'valid-token', username: 'NewUser', avatar: 'avatar.png' };
            const expectedResult = {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: {
                    id: '1',
                    username: 'NewUser',
                    phonenumber: '0912345678',
                    created: '2026-01-01',
                    avatar: 'avatar.png',
                },
            };
            mockAuthService.changeInfoAfterSignup.mockResolvedValue(expectedResult);

            const result = await controller.changeInfoAfterSignup(dto);

            expect(mockAuthService.changeInfoAfterSignup).toHaveBeenCalledWith(dto);
            expect(result).toEqual(expectedResult);
        });
    });
});
