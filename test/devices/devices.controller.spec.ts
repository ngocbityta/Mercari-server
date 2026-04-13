import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from '../../src/devices/devices.controller.ts';
import { DevicesService } from '../../src/devices/devices.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { UserStatus, Prisma } from '@prisma/client';
import { TokenGuard } from '../../src/common/guards/token.guard.ts';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('DevicesController (Integration)', () => {
    let controller: DevicesController;
    let devicesService: DevicesService;
    let guard: TokenGuard;

    const mockUser = {
        id: 'user-1',
        token: 'valid-token',
        status: UserStatus.ACTIVE,
    };

    const mockPrisma = {
        user: {
            findFirst: jest.fn(),
        },
        device: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [DevicesController],
            providers: [
                DevicesService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        controller = module.get<DevicesController>(DevicesController);
        devicesService = module.get<DevicesService>(DevicesService);
        guard = new TokenGuard(mockPrisma as any);
        jest.clearAllMocks();
    });

    describe('set_devtoken API Cases', () => {
        it('TC1: should return 1000 for valid session and parameters', async () => {
            const dto = { token: 'valid-token', devtype: 1, devtoken: 'dev-token-123' };
            jest.spyOn(devicesService, 'setDevtoken').mockResolvedValue({
                devtype: '1',
                devToken: 'dev-token-123',
            });

            const result = await controller.setDevtoken(dto, mockUser as any);

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual({ devtype: '1', devToken: 'dev-token-123' });
        });

        it('TC3: should return 1001 for database related errors', async () => {
            const dto = { token: 'valid-token', devtype: 1, devtoken: 'dev-token-123' };
            const dbError = new Prisma.PrismaClientKnownRequestError('DB Error', {
                code: 'P2002',
                clientVersion: '1.0.0',
            });
            jest.spyOn(devicesService, 'setDevtoken').mockRejectedValue(dbError);

            const result = await controller.setDevtoken(dto, mockUser as any);

            expect(result.code).toBe(ResponseCode.CAN_NOT_CONNECT);
            expect(result.message).toBe('Can not connect to DB');
        });

        it('TC5: should return 1004 for invalid devtype', async () => {
            const dto = {
                token: 'valid-token',
                devtype: 'invalid' as any,
                devtoken: 'dev-token-123',
            };

            const result = await controller.setDevtoken(dto, mockUser as any);

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });

        it('TC6: should return 1004 for missing or empty devtoken', async () => {
            const dto = { token: 'valid-token', devtype: 1, devtoken: '' };

            const result = await controller.setDevtoken(dto, mockUser as any);

            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });
    });

    describe('TokenGuard (Session Validation)', () => {
        it('TC2: should throw error 9998 for empty or missing token', async () => {
            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        body: { token: '' },
                    }),
                }),
            } as ExecutionContext;

            try {
                await guard.canActivate(mockContext);
                fail('Should have thrown UnauthorizedException');
            } catch (e) {
                expect(e).toBeInstanceOf(UnauthorizedException);
                expect(e.getResponse().code).toBe('9998');
            }
        });

        it('TC2: should throw error 9998 for invalid/non-existent token', async () => {
            mockPrisma.user.findFirst.mockResolvedValue(null);
            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        body: { token: 'invalid-token' },
                    }),
                }),
            } as ExecutionContext;

            try {
                await guard.canActivate(mockContext);
                fail('Should have thrown UnauthorizedException');
            } catch (e) {
                expect(e).toBeInstanceOf(UnauthorizedException);
                expect(e.getResponse().code).toBe('9998');
            }
        });
    });
});
