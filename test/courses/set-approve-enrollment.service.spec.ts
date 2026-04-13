import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

const mockTx = {
    enrollment: { create: jest.fn() },
    enrollmentRequest: { delete: jest.fn() },
};

const mockPrisma = {
    user: {
        findFirst: jest.fn(),
    },
    enrollmentRequest: {
        findFirst: jest.fn(),
        delete: jest.fn(),
    },
    $transaction: jest.fn(),
};

// --- Dữ liệu mock dùng chung ---
const mockGV = { id: 'gv-1', role: 'GV', status: 'ACTIVE' };

// Request có include student (ACTIVE)
const makeRequest = (studentStatus = 'ACTIVE') => ({
    id: 'req-1',
    studentId: 'hv-1',
    teacherId: 'gv-1',
    student: { status: studentStatus },
});

describe('CoursesService - setApproveEnrollment', () => {
    let service: CoursesService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CoursesService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<CoursesService>(CoursesService);
        jest.clearAllMocks();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        mockPrisma.$transaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
        mockTx.enrollment.create.mockResolvedValue({});
        mockTx.enrollmentRequest.delete.mockResolvedValue({});
    });

    /**
     * TC1: Người dùng truyền đúng mã phiên đăng nhập và các tham số khác.
     */
    it('[TC1-accept] Chấp nhận thành công → returns {}, transaction tạo Enrollment và xoá Request', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest());

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '1');

        expect(result).toEqual({});
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockTx.enrollment.create).toHaveBeenCalledWith({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: expect.objectContaining({
                studentId: 'hv-1',
                teacherId: 'gv-1',
            } as unknown as Prisma.EnrollmentCreateInput),
        });
        expect(mockTx.enrollmentRequest.delete).toHaveBeenCalledWith({
            where: { id: 'req-1' },
        });
    });

    it('[TC1-reject] Từ chối thành công → returns {}, chỉ xoá Request (không tạo Enrollment)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest());
        mockPrisma.enrollmentRequest.delete.mockResolvedValue({});

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '0');

        expect(result).toEqual({});
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockPrisma.enrollmentRequest.delete).toHaveBeenCalledWith({
            where: { id: 'req-1' },
        });
    });

    /**
     * TC2: Token sai
     */
    it('[TC2] Token sai / phiên cũ → throws ApiException TOKEN_INVALID', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.setApproveEnrollment('bad-token', 'hv-1', '1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    /**
     * TC3: Lỗi DB
     */
    it('[TC3a] DB lỗi ngay khi tra cứu token → throws Error', async () => {
        mockPrisma.user.findFirst.mockRejectedValue(new Error('Connection timeout'));

        await expect(service.setApproveEnrollment('gv-token', 'hv-1', '1')).rejects.toThrow(
            'Connection timeout',
        );
    });

    it('[TC3b] DB lỗi trong transaction khi chấp nhận → throws Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest());
        mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

        await expect(service.setApproveEnrollment('gv-token', 'hv-1', '1')).rejects.toThrow(
            'Transaction failed',
        );
    });

    /**
     * TC4: Tài khoản GV bị khoá
     */
    it('[TC4] Tài khoản GV bị khoá → throws ApiException ACCOUNT_LOCKED', async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ ...mockGV, status: 'LOCKED' });

        const call = () => service.setApproveEnrollment('locked-token', 'hv-1', '1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    /**
     * TC6: user_id không đúng
     */
    it('[TC6a] user_id không tồn tại trong DB → throws ApiException USER_NOT_VALIDATED', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(null);

        const call = () => service.setApproveEnrollment('gv-token', 'nonexistent-hv', '1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.USER_NOT_VALIDATED);
        }
    });

    it('[TC6b] HV có yêu cầu nhưng tài khoản đã bị khoá → throws ApiException USER_NOT_VALIDATED', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest('LOCKED'));

        const call = () => service.setApproveEnrollment('gv-token', 'hv-1', '1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.USER_NOT_VALIDATED);
        }
    });

    /**
     * TC8: is_accept không đúng chuẩn
     */
    it('[TC8] is_accept = "2" (không hợp lệ) → throws ApiException INVALID_PARAMETER_VALUE', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);

        const call = () => service.setApproveEnrollment('gv-token', 'hv-1', '2');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    /**
     * Bonus: HV gọi API
     */
    it('[Bonus] HV gọi API set_approve_enrollment → throws ApiException NOT_ACCESS', async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'hv-1', role: 'HV', status: 'ACTIVE' });

        const call = () => service.setApproveEnrollment('hv-token', 'hv-2', '1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NOT_ACCESS);
        }
    });
});
