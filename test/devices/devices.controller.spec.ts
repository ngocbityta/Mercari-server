import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from '../../src/devices/devices.controller.ts';
import { DevicesService } from '../../src/devices/devices.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { UserStatus, Prisma } from '@prisma/client';
import { TokenGuard } from '../../src/common/guards/token.guard.ts';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const result = await controller.setDevtoken(dto, mockUser as any);

            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data).toEqual({ devtype: '1', devToken: 'dev-token-123' });
        });

        it('TC3: should throw Prisma error and let it bubble up', async () => {
            const dto = { token: 'valid-token', devtype: 1, devtoken: 'dev-token-123' };
            const dbError = new Prisma.PrismaClientKnownRequestError('DB Error', {
                code: 'P2002',
                clientVersion: '1.0.0',
            });
            jest.spyOn(devicesService, 'setDevtoken').mockRejectedValue(dbError);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            await expect(controller.setDevtoken(dto, mockUser as any)).rejects.toThrow(
                Prisma.PrismaClientKnownRequestError,
            );
        });

        it('TC5: should throw ApiException (1004) for invalid devtype', async () => {
            const dto = {
                token: 'valid-token',
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                devtype: 'invalid' as any,
                devtoken: 'dev-token-123',
            };

            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                await controller.setDevtoken(dto, mockUser as any);
                fail('Should have thrown ApiException');
            } catch (e) {
                expect(e).toBeInstanceOf(ApiException);
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
        });

        it('TC6: should throw ApiException (1004) for missing or empty devtoken', async () => {
            const dto = { token: 'valid-token', devtype: 1, devtoken: '' };

            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                await controller.setDevtoken(dto, mockUser as any);
                fail('Should have thrown ApiException');
            } catch (e) {
                expect(e).toBeInstanceOf(ApiException);
                expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
            }
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                expect(e.getResponse().code).toBe('9998');
            }
        });
    });
});
