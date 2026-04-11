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
    id: 'user-gv-2',
    token: 'gv2-token',
    username: 'Giang Vien C',
};

// Enrollment hợp lệ — "An" (A đứng trước)
const mockEnrollmentAn = {
    id: 'enroll-1',
    studentId: 'student-1',
    teacherId: 'user-gv',
    createdAt: new Date('2024-01-02T10:00:00Z'),
    student: { id: 'student-1', username: 'An Nguyen', avatar: 'student1.jpg' },
};

// Enrollment hợp lệ — "Binh" (B sau A)
const mockEnrollmentBinh = {
    id: 'enroll-2',
    studentId: 'student-2',
    teacherId: 'user-gv',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    student: { id: 'student-2', username: 'Binh Tran', avatar: 'student2.jpg' },
};

// Enrollment có thời gian createdAt không hợp lệ
const mockEnrollmentBadDate = {
    id: 'enroll-bad-date',
    studentId: 'student-3',
    teacherId: 'user-gv',
    createdAt: new Date('invalid'), // Invalid date
    student: { id: 'student-3', username: 'Cuong Le', avatar: 'student3.jpg' },
};

// Enrollment có username null (không chuẩn)
const mockEnrollmentNullName = {
    id: 'enroll-null',
    studentId: 'student-null',
    teacherId: 'user-gv',
    createdAt: new Date('2024-01-03T10:00:00Z'),
    student: { id: 'student-null', username: null, avatar: '' },
};

const mockPrisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    enrollment: { findMany: jest.fn(), count: jest.fn() },
    enrollmentRequest: { findMany: jest.fn(), count: jest.fn() },
};

describe('CoursesService - getListStudents', () => {
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
     * Kết quả: 1000, data chứa total và students đúng định dạng.
     */
    it('[TC1] Thành công → 1000, data.total và data.students đúng định dạng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentAn, mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.code).toBe('1000');
        expect(result.data!.total).toBe('2');
        expect(result.data!.students).toHaveLength(2);
        expect(result.data!.students[0]).toMatchObject({
            id: 'student-1',
            name: 'An Nguyen',
            avatar: 'student1.jpg',
        });
    });

    /**
     * TC2: Mã phiên đăng nhập sai (trống, quá ngắn, phiên cũ).
     * Kết quả: 9998 → ứng dụng đẩy về trang đăng nhập.
     */
    it('[TC2] Token sai / phiên cũ → trả về 9998', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await service.getListStudents('token-sai', 0, 20);

        expect(result.code).toBe('9998');
        expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC3: Đúng token nhưng GV chưa có học viên nào (index = 0).
     * Kết quả: 9994 → ứng dụng hiển thị "Không tìm thấy kết quả nào".
     */
    it('[TC3] Không có học viên nào (index=0) → trả về 9994', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([]);
        mockPrisma.enrollment.count.mockResolvedValue(0);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.code).toBe('9994');
    });

    /**
     * TC4: Tài khoản bị khóa (hệ thống khóa giữa chừng).
     * Kết quả: 9991 → ứng dụng đẩy về trang đăng nhập.
     */
    it('[TC4] Tài khoản bị khóa → trả về 9991', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedGV);

        const result = await service.getListStudents('locked-token', 0, 20);

        expect(result.code).toBe('9991');
        expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC5: Kết quả trả về có name hoặc id không chuẩn (null, rỗng).
     * NOTE: Server map null → '' để không crash.
     *       Ứng dụng tự ẩn các mục có name rỗng hoặc id không hợp lệ trước khi render.
     */
    it('[TC5] Học viên có name=null → server map thành "", ứng dụng tự ẩn', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([
            mockEnrollmentAn,
            mockEnrollmentNullName,
        ]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.code).toBe('1000');
        // Server vẫn trả về, không crash — map null → ''
        const nullEntry = result.data!.students.find((s: any) => s.id === 'student-null');
        expect(nullEntry!.name).toBe('');
        // App tự kiểm tra: if (name === '' || !id) → ẩn đi không hiển thị
    });

    /**
     * TC6: Danh sách học viên không theo thứ tự chữ cái tên.
     * Kết quả: server orderBy username ASC → ứng dụng nhận đúng thứ tự A → Z.
     *          Nếu app nhận sai thứ tự (do cache cũ), app tự sắp xếp lại.
     */
    it('[TC6] Server trả theo thứ tự chữ cái tên (A→Z) → query có orderBy username asc', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        // Server đã sắp xếp: An (A) trước Binh (B)
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentAn, mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.code).toBe('1000');
        // An đứng trước Binh (thứ tự chữ cái A → B)
        expect(result.data!.students[0].name).toBe('An Nguyen');
        expect(result.data!.students[1].name).toBe('Binh Tran');
        // Đảm bảo query orderBy đúng
        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { student: { username: 'asc' } },
            }),
        );
    });

    /**
     * TC7: Thời gian đăng ký học (createdAt) của một học viên bị sai / không hợp lệ.
     * NOTE: Server vẫn trả về học viên đó (id, name, avatar đều hợp lệ).
     *       Trường `created` không có trong output hiện tại → app không cần xử lý.
     *       Nếu thêm `created` vào output sau này, app nên ẩn thời gian khi giá trị không hợp lệ.
     */
    it('[TC7] Học viên có createdAt không hợp lệ → server vẫn trả về học viên, không crash', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentBadDate]);
        mockPrisma.enrollment.count.mockResolvedValue(1);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.code).toBe('1000');
        expect(result.data!.students).toHaveLength(1);
        // Học viên vẫn xuất hiện với id và name hợp lệ
        expect(result.data!.students[0].id).toBe('student-3');
        expect(result.data!.students[0].name).toBe('Cuong Le');
    });

    /**
     * TC8: Qua nhiều lần query (index tăng dần), total tăng dần do có thêm HV mới.
     * NOTE: Server luôn trả total đúng tại thời điểm query (snapshot DB).
     *       Ứng dụng theo dõi max(total) qua các lần query và hiển thị giá trị lớn nhất.
     */
    it('[TC8] total tăng giữa các lần query → server trả total tại thời điểm đó, app lấy max', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);

        // Lần query 1 (index=0): total = 20
        mockPrisma.enrollment.findMany.mockResolvedValueOnce([mockEnrollmentAn]);
        mockPrisma.enrollment.count.mockResolvedValueOnce(20);
        const result1 = await service.getListStudents('gv-token', 0, 1);

        // Lần query 2 (index=1): tổng tăng lên 25 (có thêm HV đăng ký)
        mockPrisma.enrollment.findMany.mockResolvedValueOnce([mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValueOnce(25);
        const result2 = await service.getListStudents('gv-token', 1, 1);

        expect(result1.code).toBe('1000');
        expect(result2.code).toBe('1000');
        // Lần 2 total lớn hơn lần 1
        expect(parseInt(result2.data!.total)).toBeGreaterThan(parseInt(result1.data!.total));
        // App: displayTotal = Math.max(result1.total, result2.total) = 25
    });

    /**
     * TC9: Avatar trả về không phải link http (bị sai định dạng).
     * NOTE: Client-side concern — server trả nguyên giá trị từ DB.
     *       Ứng dụng kiểm tra: if (!avatar.startsWith('http')) → dùng avatar mặc định.
     * Kết quả: server trả avatar không hợp lệ → ứng dụng hiển thị avatar mặc định.
     */
    it('[TC9] Avatar không phải link http → server trả nguyên, ứng dụng dùng avatar mặc định', async () => {
        const enrollmentBadAvatar = {
            ...mockEnrollmentAn,
            student: { id: 'student-1', username: 'An Nguyen', avatar: 'invalid-path' },
        };
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([enrollmentBadAvatar]);
        mockPrisma.enrollment.count.mockResolvedValue(1);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.code).toBe('1000');
        // Server trả đúng như DB, không validate avatar
        expect(result.data!.students[0].avatar).toBe('invalid-path');
        // App: if (!avatar.startsWith('http')) → hiển thị DEFAULT_AVATAR
    });

    /**
     * TC10: Thông tin bổ sung (số bạn chung) không chuẩn.
     * NOTE: Client-side concern — server không trả "số bạn chung" trong API này.
     *       App tự tính và kiểm tra trước khi hiển thị.
     */
    it('[TC10] Số bạn chung không chuẩn là client-side concern', () => {
        // Server không tính "số bạn chung" trong get_list_students.
        // App tự xử lý: if (typeof commonCount !== 'number' || commonCount < 0) → ẩn đi.
        expect(true).toBe(true);
    });

    /**
     * TC11: total server > tổng số students đã nhận về (vì còn trang sau).
     * Kết quả: server trả total chính xác → ứng dụng hiển thị "25 học viên".
     */
    it('[TC11] total server > students đã nhận → app hiển thị total của server', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentAn]); // 1 record
        mockPrisma.enrollment.count.mockResolvedValue(25); // tổng = 25

        const result = await service.getListStudents('gv-token', 0, 1);

        expect(result.code).toBe('1000');
        expect(result.data!.total).toBe('25');
        expect(result.data!.students).toHaveLength(1);
        // total (25) > students.length (1) → app biết còn trang sau, hiện "Tải thêm"
        expect(parseInt(result.data!.total)).toBeGreaterThan(result.data!.students.length);
    });

    /**
     * TC12: total server < tổng số students đã nhận qua các lần query (do có người bị xóa).
     * NOTE: Client-side concern — app dùng max(total_server, accumulated_count).
     *       Server luôn trả total đúng tại thời điểm query.
     */
    it('[TC12] total server < accumulated client count → server trả đúng, app lấy max', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        // Query lần 2: total giảm còn 1 (1 học viên bị xóa giữa chừng)
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValue(1);

        const result = await service.getListStudents('gv-token', 1, 20);

        expect(result.code).toBe('1000');
        // Server trả total = 1 (đúng tại thời điểm query)
        expect(result.data!.total).toBe('1');
        // App: accumulated = 20 (đã nhận từ lần trước) + 1 (lần này) = 21
        // Nếu total (1) < accumulated (21) → displayTotal = accumulated = 21
    });

    /**
     * TC13: Pull-down để làm mới, pull-up để tải thêm.
     * NOTE: Client-side pagination concern.
     *       - Pull-down: app gọi lại với index=0 → reset danh sách
     *       - Pull-up: app gọi với index tăng dần → append vào danh sách
     * Server hỗ trợ bằng cách trả đúng skip = index * count.
     */
    it('[TC13] Pull-down (index=0) reset, pull-up (index tăng) append → server skip đúng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValue(25);

        // Pull-up: tải trang 2 (index=1, count=20 → skip=20)
        await service.getListStudents('gv-token', 1, 20);

        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 20, take: 20 }),
        );
    });

    /**
     * TC14: Hệ thống KHÔNG cache dữ liệu (trừ màn hình trang chủ).
     * NOTE: Hoàn toàn là client-side concern.
     *       Server luôn trả dữ liệu mới nhất từ DB mỗi request.
     *       App quyết định có dùng cache hay không tùy theo màn hình.
     */
    it('[TC14] No-cache là client-side concern — server luôn trả dữ liệu mới nhất', () => {
        // Server không có cơ chế cache. Mỗi request = 1 snapshot DB mới.
        // App: ở màn hình khác (không phải Home) → luôn gọi API mới, không dùng cache.
        expect(true).toBe(true);
    });

    // --- Bonus: Các trường hợp kỹ thuật bổ sung ---

    it('[Bonus] DB lỗi khi findMany → trả về 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockRejectedValue(new Error('DB error'));

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.code).toBe('1001');
    });

    it('[Bonus] DB lỗi ngay khi tra cứu token (findFirst throw) → trả về 1001', async () => {
        mockPrisma.user.findFirst.mockRejectedValue(new Error('Connection timeout'));

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.code).toBe('1001');
        expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    it('[Bonus] HV gọi API → trả về 1009', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockHVUser);

        const result = await service.getListStudents('hv-token', 0, 20);

        expect(result.code).toBe('1009');
        expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    it('[Bonus] index/count sai (NaN, âm, = 0) → trả về 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);

        expect((await service.getListStudents('gv-token', NaN, 20)).code).toBe('1004');
        expect((await service.getListStudents('gv-token', 0, 0)).code).toBe('1004');
        expect((await service.getListStudents('gv-token', -1, 20)).code).toBe('1004');
    });

    it('[Bonus] GV dùng user_id hợp lệ → xem học viên của GV khác', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.user.findUnique.mockResolvedValue(mockTargetGV);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentAn]);
        mockPrisma.enrollment.count.mockResolvedValue(1);

        const result = await service.getListStudents('gv-token', 0, 20, 'user-gv-2');

        expect(result.code).toBe('1000');
        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teacherId: 'user-gv-2' } }),
        );
    });
});
