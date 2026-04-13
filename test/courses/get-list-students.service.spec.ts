import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';

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
     */
    it('[TC1] Thành công → total và students đúng định dạng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentAn, mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.total).toBe('2');
        expect(result.students).toHaveLength(2);
        expect(result.students[0]).toMatchObject({
            id: 'student-1',
            name: 'An Nguyen',
            avatar: 'student1.jpg',
        });
    });

    /**
     * TC2: Token sai
     */
    it('[TC2] Token sai / phiên cũ → throws ApiException TOKEN_INVALID', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.getListStudents('token-sai', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    /**
     * TC3: Không có học viên nào (index = 0).
     */
    it('[TC3] Không có học viên nào (index=0) → throws ApiException NO_DATA', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([]);
        mockPrisma.enrollment.count.mockResolvedValue(0);

        const call = () => service.getListStudents('gv-token', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
        }
    });

    /**
     * TC4: Tài khoản bị khóa
     */
    it('[TC4] Tài khoản bị khóa → throws ApiException ACCOUNT_LOCKED', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedGV);

        const call = () => service.getListStudents('locked-token', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    /**
     * TC5: Học viên có name=null
     */
    it('[TC5] Học viên có name=null → server map thành ""', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([
            mockEnrollmentAn,
            mockEnrollmentNullName,
        ]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListStudents('gv-token', 0, 20);

        const nullEntry = result.students.find((s: { id: string }) => s.id === 'student-null');
        expect(nullEntry!.name).toBe('');
    });

    /**
     * TC6: Thứ tự chữ cái tên
     */
    it('[TC6] Server trả theo thứ tự chữ cái tên (A→Z) → query có orderBy username asc', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentAn, mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValue(2);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.students[0].name).toBe('An Nguyen');
        expect(result.students[1].name).toBe('Binh Tran');
        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { student: { username: 'asc' } },
            }),
        );
    });

    /**
     * TC7: createdAt không hợp lệ
     */
    it('[TC7] Học viên có createdAt không hợp lệ → server vẫn trả về học viên, không crash', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentBadDate]);
        mockPrisma.enrollment.count.mockResolvedValue(1);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.students).toHaveLength(1);
        expect(result.students[0].id).toBe('student-3');
    });

    /**
     * TC8: total tăng giữa các lần query
     */
    it('[TC8] total tăng giữa các lần query → server trả total tại thời điểm đó', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);

        mockPrisma.enrollment.findMany.mockResolvedValueOnce([mockEnrollmentAn]);
        mockPrisma.enrollment.count.mockResolvedValueOnce(20);
        const result1 = await service.getListStudents('gv-token', 0, 1);

        mockPrisma.enrollment.findMany.mockResolvedValueOnce([mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValueOnce(25);
        const result2 = await service.getListStudents('gv-token', 1, 1);

        expect(parseInt(result2.total)).toBeGreaterThan(parseInt(result1.total));
    });

    /**
     * TC9: Avatar không chuẩn
     */
    it('[TC9] Avatar không phải link http → server trả nguyên', async () => {
        const enrollmentBadAvatar = {
            ...mockEnrollmentAn,
            student: { id: 'student-1', username: 'An Nguyen', avatar: 'invalid-path' },
        };
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([enrollmentBadAvatar]);
        mockPrisma.enrollment.count.mockResolvedValue(1);

        const result = await service.getListStudents('gv-token', 0, 20);

        expect(result.students[0].avatar).toBe('invalid-path');
    });

    /**
     * TC11: total server > students đã nhận
     */
    it('[TC11] total server > students đã nhận → app hiển thị total của server', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentAn]); // 1 record
        mockPrisma.enrollment.count.mockResolvedValue(25); // tổng = 25

        const result = await service.getListStudents('gv-token', 0, 1);

        expect(result.total).toBe('25');
        expect(result.students).toHaveLength(1);
    });

    /**
     * TC13: Pagination
     */
    it('[TC13] Pagination check skip correctly', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentBinh]);
        mockPrisma.enrollment.count.mockResolvedValue(25);

        await service.getListStudents('gv-token', 1, 20);

        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 20, take: 20 }),
        );
    });

    it('[Bonus] DB lỗi khi findMany → throws Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollment.findMany.mockRejectedValue(new Error('DB error'));

        await expect(service.getListStudents('gv-token', 0, 20)).rejects.toThrow('DB error');
    });

    it('[Bonus] HV gọi API → throws ApiException NOT_ACCESS', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockHVUser);

        const call = () => service.getListStudents('hv-token', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NOT_ACCESS);
        }
    });

    it('[Bonus] index/count sai → throws ApiException INVALID_PARAMETER_VALUE', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);

        await expect(service.getListStudents('gv-token', NaN, 20)).rejects.toThrow(ApiException);
        await expect(service.getListStudents('gv-token', 0, 0)).rejects.toThrow(ApiException);
        await expect(service.getListStudents('gv-token', -1, 20)).rejects.toThrow(ApiException);
    });

    it('[Bonus] GV dùng user_id hợp lệ → xem học viên của GV khác', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.user.findUnique.mockResolvedValue(mockTargetGV);
        mockPrisma.enrollment.findMany.mockResolvedValue([mockEnrollmentAn]);
        mockPrisma.enrollment.count.mockResolvedValue(1);

        const result = await service.getListStudents('gv-token', 0, 20, 'user-gv-2');

        expect(result.students).toHaveLength(1);
        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teacherId: 'user-gv-2' } }),
        );
    });
});
