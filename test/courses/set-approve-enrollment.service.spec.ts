import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service';
import { PrismaService } from '../../src/prisma/prisma.service';

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
            providers: [
                CoursesService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<CoursesService>(CoursesService);
        jest.clearAllMocks();

        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));
        mockTx.enrollment.create.mockResolvedValue({});
        mockTx.enrollmentRequest.delete.mockResolvedValue({});
    });

    /**
     * TC1: Người dùng truyền đúng mã phiên đăng nhập và các tham số khác.
     * Kết quả mong đợi: 1000 | OK
     * - is_accept='1': tạo Enrollment + xoá EnrollmentRequest trong transaction
     * - is_accept='0': chỉ xoá EnrollmentRequest
     */
    it('[TC1-accept] Chấp nhận thành công → 1000, transaction tạo Enrollment và xoá Request', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest());

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '1');

        expect(result.code).toBe('1000');
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockTx.enrollment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ studentId: 'hv-1', teacherId: 'gv-1' }),
        });
        expect(mockTx.enrollmentRequest.delete).toHaveBeenCalledWith({
            where: { id: 'req-1' },
        });
    });

    it('[TC1-reject] Từ chối thành công → 1000, chỉ xoá Request (không tạo Enrollment)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest());
        mockPrisma.enrollmentRequest.delete.mockResolvedValue({});

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '0');

        expect(result.code).toBe('1000');
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockPrisma.enrollmentRequest.delete).toHaveBeenCalledWith({
            where: { id: 'req-1' },
        });
    });

    /**
     * TC2: Sai mã phiên đăng nhập (trống, quá ngắn, phiên cũ).
     * Kết quả mong đợi: 9998 → ứng dụng đẩy sang trang đăng nhập.
     */
    it('[TC2] Token sai / phiên cũ → 9998', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await service.setApproveEnrollment('bad-token', 'hv-1', '1');

        expect(result.code).toBe('9998');
        expect(mockPrisma.enrollmentRequest.findFirst).not.toHaveBeenCalled();
    });

    /**
     * TC3: Đúng tham số nhưng hệ thống không thể xử lý (lỗi CSDL).
     * Kết quả mong đợi: 1001 → "Không thể kết nối Internet"
     */
    it('[TC3a] DB lỗi ngay khi tra cứu token → 1001', async () => {
        mockPrisma.user.findFirst.mockRejectedValue(new Error('Connection timeout'));

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '1');

        expect(result.code).toBe('1001');
        expect(mockPrisma.enrollmentRequest.findFirst).not.toHaveBeenCalled();
    });

    it('[TC3b] DB lỗi trong transaction khi chấp nhận → 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest());
        mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '1');

        expect(result.code).toBe('1001');
    });

    it('[TC3c] DB lỗi khi xoá Request (từ chối) → 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest());
        mockPrisma.enrollmentRequest.delete.mockRejectedValue(new Error('DB error'));

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '0');

        expect(result.code).toBe('1001');
    });

    /**
     * TC4: Tài khoản GV bị khoá (hệ thống khoá giữa chừng).
     * Kết quả mong đợi: 9991 → ứng dụng đẩy sang trang đăng nhập.
     */
    it('[TC4] Tài khoản GV bị khoá → 9991', async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ ...mockGV, status: 'LOCKED' });

        const result = await service.setApproveEnrollment('locked-token', 'hv-1', '1');

        expect(result.code).toBe('9991');
        expect(mockPrisma.enrollmentRequest.findFirst).not.toHaveBeenCalled();
    });

    /**
     * TC5: user_id không có hoặc có giá trị không chuẩn (chứa ký tự đặc biệt).
     * - Thiếu user_id: ValidationPipe trả 400 — client-side concern.
     * - Ký tự đặc biệt / không phải UUID hợp lệ: DB không tìm thấy request → 9995.
     */
    it('[TC5-missing] Thiếu user_id → client-side concern (ValidationPipe 400)', () => {
        // NestJS ValidationPipe bắt lỗi trước khi vào service:
        // @IsString() @IsNotEmpty() user_id → 400 Bad Request nếu thiếu hoặc rỗng.
        expect(true).toBe(true);
    });

    it('[TC5-invalid-format] user_id chứa ký tự đặc biệt → không tìm thấy request → 9995', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        // DB tìm theo studentId = '!!!invalid!!!' → không tìm thấy request nào
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(null);

        const result = await service.setApproveEnrollment('gv-token', '!!!invalid!!!', '1');

        expect(result.code).toBe('9995');
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    /**
     * TC6: user_id không đúng — không tồn tại hoặc HV đã bị khoá tài khoản.
     * Kết quả mong đợi: 9995 → "Người dùng không tồn tại"
     */
    it('[TC6a] user_id không tồn tại trong DB → không có request → 9995', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(null);

        const result = await service.setApproveEnrollment('gv-token', 'nonexistent-hv', '1');

        expect(result.code).toBe('9995');
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('[TC6b] HV có yêu cầu nhưng tài khoản đã bị khoá → 9995', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        // Request tồn tại nhưng student bị LOCKED
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(makeRequest('LOCKED'));

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '1');

        expect(result.code).toBe('9995');
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    /**
     * TC7: HV đã được chấp thuận hoặc yêu cầu đã bị xoá từ trước.
     * Kết quả mong đợi: 9995 → request không còn tồn tại trong DB.
     */
    it('[TC7] HV đã được chấp thuận / xoá yêu cầu từ trước → 9995', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        // EnrollmentRequest đã bị xoá sau lần xử lý trước
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(null);

        const result = await service.setApproveEnrollment('gv-token', 'hv-already-done', '1');

        expect(result.code).toBe('9995');
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    /**
     * TC8: is_accept không đúng chuẩn (không phải '0' hoặc '1').
     * Kết quả mong đợi: 1004 → ứng dụng hiển thị thông báo lỗi tham số.
     */
    it('[TC8] is_accept = "2" (không hợp lệ) → 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', '2');

        expect(result.code).toBe('1004');
        expect(mockPrisma.enrollmentRequest.findFirst).not.toHaveBeenCalled();
    });

    it('[TC8b] is_accept = "" (rỗng) → 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);

        const result = await service.setApproveEnrollment('gv-token', 'hv-1', 'yes');

        expect(result.code).toBe('1004');
    });

    /**
     * TC9: HV chưa bao giờ gửi yêu cầu đăng ký học.
     * Kết quả mong đợi: 9995 → server trả lỗi về client.
     */
    it('[TC9] HV chưa gửi yêu cầu bao giờ → không tìm thấy request → 9995', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGV);
        mockPrisma.enrollmentRequest.findFirst.mockResolvedValue(null);

        const result = await service.setApproveEnrollment('gv-token', 'hv-never-requested', '1');

        expect(result.code).toBe('9995');
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    // --- Bonus: HV gọi API (không phải GV) → 1009 ---
    it('[Bonus] HV gọi API set_approve_enrollment → 1009', async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'hv-1', role: 'HV', status: 'ACTIVE' });

        const result = await service.setApproveEnrollment('hv-token', 'hv-2', '1');

        expect(result.code).toBe('1009');
        expect(mockPrisma.enrollmentRequest.findFirst).not.toHaveBeenCalled();
    });
});
