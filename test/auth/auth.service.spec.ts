import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service.ts';
import { UsersService } from '../../src/users/users.service.ts';
import { TokenService } from '../../src/auth/token.service.ts';
import { VerificationService } from '../../src/auth/verification.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { UserStatus, UserRole } from '@prisma/client';
import { saveUserUploadedImage } from '../../src/common/uploads/profile-upload.ts';
import type { ChangeInfoAfterSignupDto } from '../../src/auth/auth.dto.ts';

jest.mock('../../src/common/uploads/profile-upload.ts', () => ({
    saveUserUploadedImage: jest.fn(),
}));

const mockUser = {
    id: 'user-1',
    phonenumber: '0901234567',
    password: 'password123',
    username: 'user1',
    avatar: 'current-avatar',
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

const validChangeInfoDto: ChangeInfoAfterSignupDto = {
    token: 'x'.repeat(36),
    username: 'new_user',
    height: '170',
};

describe('AuthService', () => {
    let service: AuthService;
    let usersService: jest.Mocked<UsersService>;
    let verificationService: jest.Mocked<VerificationService>;
    let mockedSaveUserUploadedImage: jest.MockedFunction<typeof saveUserUploadedImage>;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockedSaveUserUploadedImage = jest.mocked(saveUserUploadedImage);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: {
                        findByPhonenumber: jest.fn(),
                        findByToken: jest.fn(),
                        update: jest.fn(),
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

    describe('changeInfoAfterSignup', () => {
        const avatarFile = {
            fieldname: 'avatar',
            originalname: 'avatar.png',
            mimetype: 'image/png',
            size: 1024,
            buffer: Buffer.from('avatar'),
        };

        it('should require a valid token', async () => {
            const result = await service.changeInfoAfterSignup({
                ...validChangeInfoDto,
                token: '',
            });

            expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
        });

        it('should require username', async () => {
            usersService.findByToken.mockResolvedValue({
                ...mockUser,
                token: validChangeInfoDto.token,
            });

            const result = await service.changeInfoAfterSignup({
                ...validChangeInfoDto,
                username: '',
            });

            expect(result.code).toBe(ResponseCode.MISSING_PARAMETER);
            expect(result.message).toBe('Username is required');
        });

        it('should require height', async () => {
            usersService.findByToken.mockResolvedValue({
                ...mockUser,
                token: validChangeInfoDto.token,
            });

            const result = await service.changeInfoAfterSignup({
                ...validChangeInfoDto,
                height: '',
            });

            expect(result.code).toBe(ResponseCode.MISSING_PARAMETER);
            expect(result.message).toBe('Height is required');
        });

        it('should update username and height without requiring avatar', async () => {
            usersService.findByToken.mockResolvedValue({
                ...mockUser,
                token: validChangeInfoDto.token,
            });
            usersService.update.mockResolvedValue({
                ...mockUser,
                username: validChangeInfoDto.username,
                height: validChangeInfoDto.height,
                token: validChangeInfoDto.token,
            });

            const result = await service.changeInfoAfterSignup(validChangeInfoDto);

            expect(mockedSaveUserUploadedImage).not.toHaveBeenCalled();
            expect(usersService.update.mock.calls[0]).toEqual([
                mockUser.id,
                {
                    username: validChangeInfoDto.username,
                    height: validChangeInfoDto.height,
                },
            ]);
            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toMatchObject({
                id: mockUser.id,
                username: validChangeInfoDto.username,
                phonenumber: mockUser.phonenumber,
                avatar: mockUser.avatar,
            });
        });

        it('should upload avatar when avatar file is provided', async () => {
            const uploadedAvatarPath = '/uploads/users/avatar.png';
            usersService.findByToken.mockResolvedValue({
                ...mockUser,
                token: validChangeInfoDto.token,
            });
            usersService.update.mockResolvedValue({
                ...mockUser,
                username: validChangeInfoDto.username,
                height: validChangeInfoDto.height,
                avatar: uploadedAvatarPath,
                token: validChangeInfoDto.token,
            });
            mockedSaveUserUploadedImage.mockResolvedValue(uploadedAvatarPath);

            const result = await service.changeInfoAfterSignup(validChangeInfoDto, avatarFile);

            expect(mockedSaveUserUploadedImage).toHaveBeenCalledWith(avatarFile);
            expect(usersService.update.mock.calls[0]).toEqual([
                mockUser.id,
                {
                    username: validChangeInfoDto.username,
                    height: validChangeInfoDto.height,
                    avatar: uploadedAvatarPath,
                },
            ]);
            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toMatchObject({
                avatar: uploadedAvatarPath,
            });
        });

        it('should validate username', async () => {
            usersService.findByToken.mockResolvedValue({
                ...mockUser,
                token: validChangeInfoDto.token,
            });

            const result = await service.changeInfoAfterSignup({
                ...validChangeInfoDto,
                username: 'https://example.com',
            });

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            expect(result.message).toBe('Username must not be a URL');
        });
    });
});
