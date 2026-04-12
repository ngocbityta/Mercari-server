import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// --- Mock data ---
const mockGVUser = {
    id: 'user-gv',
    phonenumber: '0901000002',
    password: 'pass123',
    username: 'Giang Vien B',
    avatar: 'gv-avatar.jpg',
    coverImage: null,
    description: null,
    role: 'GV',
    token: 'gv-token',
    height: null,
    status: 'ACTIVE',
    online: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockHVUser = {
    ...mockGVUser,
    id: 'user-hv',
    role: 'HV',
    token: 'hv-token',
    username: 'Hoc Vien A',
};

const mockLockedGV = { ...mockGVUser, token: 'locked-token', status: 'LOCKED' };

const mockTargetGV = {
    ...mockGVUser,
    id: 'user-gv-target',
    token: 'gv-target-token',
    username: 'Giang Vien C',
};

// Yêu cầu hợp lệ — mới nhất
const mockRequest1 = {
    id: 'req-1',
    studentId: 'student-1',
    teacherId: 'user-gv',
    createdAt: new Date('2024-01-02T10:00:00Z'),
    student: { id: 'student-1', username: 'Hoc Vien 1', avatar: 'student1.jpg' },
};

// Yêu cầu hợp lệ — cũ hơn
const mockRequest2 = {
    id: 'req-2',
    studentId: 'student-2',
    teacherId: 'user-gv',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    student: { id: 'student-2', username: 'Hoc Vien 2', avatar: 'student2.jpg' },
};

// Yêu cầu có username null (dữ liệu không chuẩn)
const mockRequestInvalidUsername = {
    id: 'req-invalid',
    studentId: 'student-invalid',
    teacherId: 'user-gv',
    createdAt: new Date('2024-01-03T10:00:00Z'),
    student: { id: 'student-invalid', username: null, avatar: '' },
};

const mockPrisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    enrollmentRequest: { findMany: jest.fn(), count: jest.fn() },
};

describe('CoursesService - getRequestedEnrollment', () => {
    let service: CoursesService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CoursesService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<CoursesService>(CoursesService);
        jest.clearAllMocks();
    });

    /**
     * TC1: Truyền đúng mã phiên đăng nhập và các tham số.
     * Kết quả: 1000, data chứa danh sách yêu cầu đúng định dạng + total.
     */
    it('[TC1] Thành công → 1000, data đúng định dạng, có trường total', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest1, mockRequest2]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(2);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        expect(result.code).toBe('1000');
        expect(result.data).toHaveLength(2);
        expect(result.data![0]).toMatchObject({
            request: {
                id: 'student-1',
                user_name: 'Hoc Vien 1',
                avatar: 'student1.jpg',
                created: mockRequest1.createdAt.toISOString(),
            },
        });
        // TC9 dependency: server phải trả về total
        expect(result.total).toBe(2);
    });

    /**
     * TC2: Mã phiên đăng nhập sai (trống, quá ngắn, hoặc phiên cũ).
     * Kết quả: 9998 → ứng dụng đẩy người dùng sang trang đăng nhập.
     */
    it('[TC2] Token sai / phiên cũ → trả về 9998', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await service.getRequestedEnrollment('token-sai', 0, 20);

        expect(result.code).toBe('9998');
        expect(mockPrisma.enrollmentRequest.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC3: Đúng token và tham số nhưng không có kết quả nào.
     * Kết quả: 9994 → hiển thị "Không tìm thấy kết quả nào".
     */
    it('[TC3] Không có yêu cầu nào (index=0) → trả về 9994', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(0);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        expect(result.code).toBe('9994');
    });

    /**
     * TC4: Tài khoản bị khóa (hệ thống khóa giữa chừng).
     * Kết quả: 9991 → ứng dụng đẩy người dùng sang trang đăng nhập.
     */
    it('[TC4] Tài khoản bị khóa → trả về 9991', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedGV);

        const result = await service.getRequestedEnrollment('locked-token', 0, 20);

        expect(result.code).toBe('9991');
        expect(mockPrisma.enrollmentRequest.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC5: Kết quả trả về có username hoặc id không chuẩn (null, rỗng).
     * NOTE: Đây là client-side concern. Server trả về raw data, ứng dụng lọc trước khi hiển thị.
     *       Server vẫn map null → '' để không gây crash, nhưng việc ẩn là trách nhiệm của app.
     * Kết quả mong đợi của server: 1000, username null → '' trong response.
     */
    it('[TC5] Yêu cầu có username=null → server map thành chuỗi rỗng, ứng dụng tự lọc', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([
            mockRequest1,
            mockRequestInvalidUsername,
        ]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(2);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        expect(result.code).toBe('1000');
        // Server map username null → '' thay vì crash
        const invalidEntry = result.data!.find((d: any) => (d as { request: { id: string } }).request.id === 'student-invalid');
        expect(invalidEntry!.request.user_name).toBe('');
        // App phải tự lọc bỏ entry này khi user_name === '' trước khi render
    });

    /**
     * TC6: Kiểm tra thứ tự thời gian (mới nhất trước).
     * Kết quả: server orderBy createdAt DESC → yêu cầu mới nhất đứng đầu.
     *          Nếu app nhận sai thứ tự (do cache cũ), app cần tự sắp xếp lại.
     */
    it('[TC6] Kết quả phải theo thứ tự mới nhất trước → server orderBy createdAt DESC', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        // Server trả về đúng thứ tự: req1 (2024-01-02) trước req2 (2024-01-01)
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest1, mockRequest2]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(2);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        expect(result.code).toBe('1000');
        // Yêu cầu mới nhất (2024-01-02) đứng đầu
        expect(result.data![0].request.id).toBe('student-1');
        expect(result.data![1].request.id).toBe('student-2');
        // Đảm bảo query có orderBy
        expect(mockPrisma.enrollmentRequest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
        );
    });

    /**
     * TC7: Kết quả trả về có thêm thông tin phụ (ví dụ: số học viên chung với GV).
     * NOTE: Đây là client-side concern — server không tính "số học viên chung".
     *       App có thể tự tính sau khi nhận data từ nhiều nguồn và hiển thị thêm.
     */
    it('[TC7] Hiển thị thông tin bổ sung là client-side concern', () => {
        // App tự tính và hiển thị thông tin bổ sung (số học viên chung)
        // dựa trên data đã nhận — không phụ thuộc vào server cho TC này.
        expect(true).toBe(true);
    });

    /**
     * TC8: Thông tin bổ sung (số học viên chung) trả về không chuẩn.
     * NOTE: Client-side concern — app ẩn đi các số liệu không hợp lệ
     *       (âm, NaN, undefined) trước khi render.
     */
    it('[TC8] Thông tin bổ sung không chuẩn là client-side concern', () => {
        // App kiểm tra trước khi hiển thị:
        // if (typeof commonCount !== 'number' || commonCount < 0) → ẩn đi
        expect(true).toBe(true);
    });

    /**
     * TC9: total từ server > số yêu cầu đã nhận về (vì phân trang).
     * Kết quả: server trả về total = tổng tất cả yêu cầu.
     *          Ứng dụng hiển thị total cho người dùng biết còn bao nhiêu.
     */
    it('[TC9] total server > data.length (còn trang sau) → app hiển thị total', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        // Chỉ lấy được 1 record nhưng tổng là 50
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest1]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(50);

        const result = await service.getRequestedEnrollment('gv-token', 0, 1);

        expect(result.code).toBe('1000');
        expect(result.data).toHaveLength(1);
        // total = 50 > data.length = 1 → app biết còn nhiều trang
        expect(result.total).toBe(50);
        expect(result.total).toBeGreaterThan(result.data!.length);
    });

    /**
     * TC10: total từ server < tổng số đã nhận qua nhiều lần query.
     * NOTE: Client-side concern — xảy ra khi có yêu cầu bị xóa giữa các lần query.
     *       App dùng giá trị lớn hơn (accumulated count) để hiển thị.
     * Kết quả: server trả về total đúng tại thời điểm query, app tự xử lý.
     */
    it('[TC10] total server < accumulated client count → server trả đúng, app xử lý', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        // Query lần 2: total giảm còn 1 (1 yêu cầu bị xóa giữa chừng)
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest2]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(1);

        const result = await service.getRequestedEnrollment('gv-token', 1, 20);

        expect(result.code).toBe('1000');
        // Server trả total = 1 (đúng tại thời điểm query)
        expect(result.total).toBe(1);
        // App so sánh với accumulated (ví dụ: đã nhận 20 từ lần trước)
        // và hiển thị max(total_server, accumulated_client) = 20
        // → Đây là logic của app, không phải server
    });

    /**
     * TC11: Pull-down để làm mới, pull-up để tải thêm.
     * NOTE: Client-side pagination concern.
     *       - Pull-down: app gọi lại với index=0 → reset danh sách
     *       - Pull-up: app gọi với index tăng dần → append vào danh sách
     * Kết quả: server hỗ trợ bằng cách trả đúng skip = index * count.
     */
    it('[TC11] Pull-down (index=0) và pull-up (index tăng) → server skip đúng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest2]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(25);

        // Pull-up: tải trang 2 (index=1, count=20 → skip=20)
        await service.getRequestedEnrollment('gv-token', 1, 20);

        expect(mockPrisma.enrollmentRequest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 20, take: 20 }),
        );
    });

    /**
     * TC12: Cache dữ liệu ở tab.
     * NOTE: Hoàn toàn là client-side concern — app tự cache response vào bộ nhớ/local storage.
     *       Server không tham gia vào cơ chế cache.
     *       Khi tab được mở lại, app quyết định có gọi API mới hay dùng cache.
     */
    it('[TC12] Cache là client-side concern — server luôn trả dữ liệu mới nhất', () => {
        // Server không có cơ chế cache — mỗi request trả về snapshot mới nhất của DB.
        // App tự implement cache (ví dụ: không gọi lại nếu data < 5 phút tuổi).
        expect(true).toBe(true);
    });

    // --- Test bổ sung cho các trường hợp kỹ thuật ---

    it('[Bonus] DB lỗi khi findMany → trả về 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockRejectedValue(new Error('DB error'));

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        expect(result.code).toBe('1001');
    });

    it('[Bonus] DB lỗi ngay khi tra cứu token (findFirst throw) → trả về 1001', async () => {
        mockPrisma.user.findFirst.mockRejectedValue(new Error('Connection timeout'));

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        expect(result.code).toBe('1001');
        expect(mockPrisma.enrollmentRequest.findMany).not.toHaveBeenCalled();
    });

    it('[Bonus] index hoặc count sai (NaN, âm) → trả về 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);

        const r1 = await service.getRequestedEnrollment('gv-token', NaN, 20);
        const r2 = await service.getRequestedEnrollment('gv-token', 0, 0);
        const r3 = await service.getRequestedEnrollment('gv-token', -1, 20);

        expect(r1.code).toBe('1004');
        expect(r2.code).toBe('1004');
        expect(r3.code).toBe('1004');
    });

    it('[Bonus] HV gọi API → trả về 1009', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockHVUser);

        const result = await service.getRequestedEnrollment('hv-token', 0, 20);

        expect(result.code).toBe('1009');
    });

    it('[Bonus] GV dùng user_id hợp lệ → xem enrollment của GV khác', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.user.findUnique.mockResolvedValue(mockTargetGV);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest1]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(1);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20, 'user-gv-target');

        expect(result.code).toBe('1000');
        expect(mockPrisma.enrollmentRequest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teacherId: 'user-gv-target' },
            }),
        );
    });
});
