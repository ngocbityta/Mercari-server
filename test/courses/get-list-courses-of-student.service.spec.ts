import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

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
     */
    it('[TC1] Thành công → total và courses đúng định dạng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment1, mockEnrollment2]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        expect(result.total).toBe('2');
        expect(result.courses).toHaveLength(2);
        expect(result.courses[0]).toMatchObject({
            id: 'gv-1',
            name: 'Giang Vien A',
            avatar: 'gv1-avatar.jpg',
        });
        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { studentId: 'hv-1' } }),
        );
    });

    /**
     * TC2: Sai token
     */
    it('[TC2] Token sai / phiên cũ → throws ApiException TOKEN_INVALID', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.getListCoursesOfStudent('bad-token', 0, 20, 'hv-1');
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

        await expect(service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1')).rejects.toThrow(
            'Connection timeout',
        );
    });

    it('[TC3b] DB lỗi khi query enrollment → throws Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockRejectedValue(new Error('DB error'));

        await expect(service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1')).rejects.toThrow(
            'DB error',
        );
    });

    /**
     * TC4: Tài khoản bị khoá
     */
    it('[TC4] Tài khoản người gọi bị khoá → throws ApiException ACCOUNT_LOCKED', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedRequester);

        const call = () => service.getListCoursesOfStudent('locked-token', 0, 20, 'hv-1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    /**
     * TC5: HV không tồn tại
     */
    it('[TC5] user_id không tồn tại trong DB → throws ApiException USER_NOT_VALIDATED', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const call = () => service.getListCoursesOfStudent('valid-token', 0, 20, 'nonexistent-id');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.USER_NOT_VALIDATED);
        }
    });

    /**
     * TC6: courses có id trùng requester
     */
    it('[TC6] courses có id trùng requester → server trả nguyên', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment1, mockEnrollmentSelf]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');

        expect(result.courses).toHaveLength(2);
    });

    /**
     * TC8: total > max students
     */
    it('[TC8] total > max students GV có thể quản lý → server vẫn chấp nhận', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollment1]);
        mockPrisma.enrollment.count.mockResolvedValue(60);

        const result = await service.getListCoursesOfStudent('valid-token', 0, 1, 'hv-1');

        expect(parseInt(result.total)).toBe(60);
    });

    /**
     * TC9a: HV không có khoá học nào (index=0)
     */
    it('[TC9a] HV không có khoá học nào (index=0) → throws ApiException NO_DATA', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([]);
        mockPrisma.enrollment.count.mockResolvedValue(0);

        const call = () => service.getListCoursesOfStudent('valid-token', 0, 20, 'hv-1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
        }
    });

    it('[TC9b] Pull-up vượt quá cuối danh sách (index>0, kết quả rỗng) → trả về courses rỗng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([]); // hết dữ liệu
        mockPrisma.enrollment.count.mockResolvedValue(5);

        const result = await service.getListCoursesOfStudent('valid-token', 2, 5, 'hv-1');

        expect(result.courses).toHaveLength(0);
    });

    /**
     * Bonus cases
     */
    it('[Bonus] index âm → throws ApiException INVALID_PARAMETER_VALUE', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);

        await expect(
            service.getListCoursesOfStudent('valid-token', -1, 20, 'hv-1'),
        ).rejects.toThrow(ApiException);
    });

    it('[Bonus] count = 0 → throws ApiException INVALID_PARAMETER_VALUE', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockRequester);
        mockPrisma.user.findUnique.mockResolvedValue(mockHVUser);

        await expect(service.getListCoursesOfStudent('valid-token', 0, 0, 'hv-1')).rejects.toThrow(
            ApiException,
        );
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
