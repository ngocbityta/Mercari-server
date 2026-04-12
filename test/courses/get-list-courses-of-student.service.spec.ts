import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// --- Mock data ---
const mockRequester = {
    id: 'requester-1',
    role: 'GV',
    status: 'ACTIVE',
    token: 'valid-token',
};

const mockHVUser = {
    id: 'hv-1',
    username: 'Hoc Vien A',
    avatar: 'hv-avatar.jpg',
    role: 'HV',
    status: 'ACTIVE',
};

const mockLockedRequester = { ...mockRequester, status: 'LOCKED', token: 'locked-token' };

// Enrollment: HV học với GV1
const mockEnrollment1 = {
    id: 'enroll-1',
    studentId: 'hv-1',
    teacherId: 'gv-1',
    createdAt: new Date('2024-02-01T10:00:00Z'),
    teacher: { id: 'gv-1', username: 'Giang Vien A', avatar: 'gv1-avatar.jpg' },
};

// Enrollment: HV học với GV2
const mockEnrollment2 = {
    id: 'enroll-2',
    studentId: 'hv-1',
    teacherId: 'gv-2',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    teacher: { id: 'gv-2', username: 'Giang Vien B', avatar: 'gv2-avatar.jpg' },
};

// Enrollment có id của teacher = id của requester (cùng người)
const mockEnrollmentSelf = {
    id: 'enroll-self',
    studentId: 'hv-1',
    teacherId: 'requester-1',
    createdAt: new Date('2024-01-20T10:00:00Z'),
    teacher: { id: 'requester-1', username: 'Chinh Nguoi Dung', avatar: 'self-avatar.jpg' },
};

const mockPrisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    enrollment: { findMany: jest.fn(), count: jest.fn() },
};

describe('CoursesService - getListCoursesOfStudent', () => {
    let service: CoursesService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CoursesService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<CoursesService>(CoursesService);
        jest.clearAllMocks();
    });

    /**
     * TC1: Người dùng truyền đúng mã phiên đăng nhập và các tham số khác.
     * Kết quả: 1000, data chứa total (string) và courses [{id, name, avatar}].
     */
    it('[TC1] Thành công → 1000, data.total và data.courses đúng định dạng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment1, mockEnrollment2]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        expect(result.code).toBe('1000');
        expect(result.data).toBeDefined();
        expect(result.data!.total).toBe('2');
        expect(result.data!.courses).toHaveLength(2);
        expect(result.data!.courses[0]).toMatchObject({
            id: 'gv-1',
            name: 'Giang Vien A',
            avatar: 'gv1-avatar.jpg',
        });
        // Server đảm bảo where đúng
        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { studentId: 'hv-1' } }),
        );
    });

    /**
     * TC2: Sai mã phiên đăng nhập (trống, quá ngắn, phiên cũ).
     * Kết quả: 9998 → ứng dụng đẩy sang trang đăng nhập.
     */
    it('[TC2] Token sai / phiên cũ → 9998', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await service.getListCoursesOfStudent('bad-token', 0, 20, 'hv-1');

        expect(result.code).toBe('9998');
        expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC3: Đúng tham số nhưng hệ thống không thể xử lý (lỗi truy cập CSDL).
     * Kết quả: 1001 → "Không thể kết nối Internet"
     */
    it('[TC3a] DB lỗi ngay khi tra cứu token → 1001', async () => {
        mockPrisma.user.findFirst.mockRejectedValue(new Error('Connection timeout'));

        const result = await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        expect(result.code).toBe('1001');
        expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    it('[TC3b] DB lỗi khi query enrollment → 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockRejectedValue(new Error('DB error'));

        const result = await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        expect(result.code).toBe('1001');
    });

    /**
     * TC4: Tài khoản người gọi bị khoá (hệ thống khoá giữa chừng).
     * Kết quả: 9991 → ứng dụng đẩy sang trang đăng nhập.
     */
    it('[TC4] Tài khoản người gọi bị khoá → 9991', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedRequester);

        const result = await service.getListCoursesOfStudent('locked-token', 0, 20, 'hv-1');

        expect(result.code).toBe('9991');
        expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC5: Không có người dùng nào có user_id như tham số yêu cầu.
     * Kết quả: 9995 → ứng dụng báo "Người dùng không tồn tại".
     */
    it('[TC5] user_id không tồn tại trong DB → 9995', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const result = await service.getListCoursesOfStudent(
            'valid-token',
            0,
            20,
            'nonexistent-id',
        );

        expect(result.code).toBe('9995');
        expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC6: Server trả về courses, nhưng có một course.id trùng với id của requester.
     * NOTE: Client-side concern — server trả nguyên danh sách từ DB.
     *       App phải tự lọc: courses.filter(c => c.id !== currentUserId)
     */
    it('[TC6] courses có id trùng requester → server trả nguyên, app tự lọc', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        // Server trả về cả enroll1 và enrollSelf (id = requester-1)
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment1, mockEnrollmentSelf]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        expect(result.code).toBe('1000');
        // Server trả đủ 2 phần tử, không tự lọc
        expect(result.data!.courses).toHaveLength(2);
        // App phải tự lọc: courses.filter(c => c.id !== requester.id)
        const filtered = result.data!.courses.filter((c: { id: string }) => c.id !== mockRequester.id);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('gv-1');
    });

    /**
     * TC7: Server trả total không đúng định dạng (không phải số hoặc âm).
     * NOTE: Client-side concern — server luôn trả total = count() từ DB (số nguyên dương).
     *       Nếu app nhận được total không hợp lệ:
     *       - parseInt(total) là NaN hoặc < 0 → displayTotal = courses.length
     */
    it('[TC7] total không đúng định dạng → client-side concern, app dùng courses.length', async () => {
        // Server luôn trả total hợp lệ (từ prisma.enrollment.count).
        // Trường hợp này chỉ xảy ra do lỗi mạng làm biến dạng response → app tự xử lý.
        // App: if (isNaN(parseInt(total)) || parseInt(total) < 0) → displayTotal = courses.length
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment1]);
        mockPrisma.enrollment.count.mockResolvedValue(1);

        const result = await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        // Server trả total hợp lệ
        expect(result.code).toBe('1000');
        expect(parseInt(result.data!.total)).toBeGreaterThanOrEqual(0);
        // App: nếu total bị lỗi → fallback = courses.length
        const safeTotalApp =
            isNaN(parseInt(result.data!.total)) || parseInt(result.data!.total) < 0
                ? result.data!.courses.length
                : parseInt(result.data!.total);
        expect(safeTotalApp).toBe(1);
    });

    /**
     * TC8: Server trả total lớn hơn giá trị cực đại số HV mà một GV có thể quản lý.
     * NOTE: Client-side concern — ứng dụng chấp nhận con số đó, không giới hạn.
     *       Server không biết và không kiểm tra "max students per GV" trong GET API này.
     */
    it('[TC8] total > max students GV có thể quản lý → client-side concern, app vẫn chấp nhận', async () => {
        const MAX_STUDENTS = 50; // giả sử business rule là 50
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment1]);
        mockPrisma.enrollment.count.mockResolvedValue(MAX_STUDENTS + 10); // 60 > 50

        const result = await service.getListCoursesOfStudent('valid-token', 0, 1, 'hv-1');

        expect(result.code).toBe('1000');
        // Server trả total = 60, vượt giới hạn nghiệp vụ
        expect(parseInt(result.data!.total)).toBeGreaterThan(MAX_STUDENTS);
        // App: vẫn hiển thị số đó, không cắt bớt
    });

    /**
     * TC9: HV đã có đủ số lượng khoá học tối đa — khi query trang tiếp theo
     * thì không còn dữ liệu (end of list).
     * Kết quả: index=0 và list rỗng → server trả 9994.
     *          index>0 và list rỗng → server trả 1000, courses=[] (app tự xử lý).
     */
    it('[TC9a] HV không có khoá học nào (index=0) → 9994', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([]);
        mockPrisma.enrollment.count.mockResolvedValue(0);

        const result = await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        expect(result.code).toBe('9994');
    });

    it('[TC9b] Pull-up vượt quá cuối danh sách (index>0, kết quả rỗng) → 1000, courses rỗng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([]); // hết dữ liệu
        mockPrisma.enrollment.count.mockResolvedValue(5);

        const result = await service.getListCoursesOfStudent('valid-token', 2, 5, 'hv-1');

        // index > 0 → server trả 1000 dù courses rỗng (app biết đã tới cuối)
        expect(result.code).toBe('1000');
        expect(result.data!.courses).toHaveLength(0);
    });

    // --- Bonus ---

    it('[Bonus] index âm → 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);

        const result = await service.getListCoursesOfStudent('valid-token', -1, 20, 'hv-1');

        expect(result.code).toBe('1004');
    });

    it('[Bonus] count = 0 → 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);

        const result = await service.getListCoursesOfStudent('valid-token', 0, 0, 'hv-1');

        expect(result.code).toBe('1004');
    });

    it('[Bonus] Kết quả sắp xếp mới nhất trước → orderBy createdAt DESC', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment1, mockEnrollment2]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
        );
    });

    it('[Bonus] Pagination đúng: index=1, count=5 → skip=5', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment2]);
        mockPrisma.enrollment.count.mockResolvedValue(10);

        await service.getListCoursesOfStudent('valid-token', 1, 5, 'hv-1');

        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 5, take: 5 }),
        );
    });
});
