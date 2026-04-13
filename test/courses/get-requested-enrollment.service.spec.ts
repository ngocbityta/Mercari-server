import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

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
     */
    it('[TC1] Thành công → data đúng định dạng, có trường total', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest1, mockRequest2]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(2);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toMatchObject({
            request: {
                id: 'student-1',
                user_name: 'Hoc Vien 1',
                avatar: 'student1.jpg',
                created: mockRequest1.createdAt.toISOString(),
            },
        });
        expect(result.total).toBe(2);
    });

    /**
     * TC2: Token sai
     */
    it('[TC2] Token sai / phiên cũ → throws ApiException TOKEN_INVALID', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.getRequestedEnrollment('token-sai', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    /**
     * TC3: Không có yêu cầu nào
     */
    it('[TC3] Không có yêu cầu nào (index=0) → throws ApiException NO_DATA', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(0);

        const call = () => service.getRequestedEnrollment('gv-token', 0, 20);
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

        const call = () => service.getRequestedEnrollment('locked-token', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    /**
     * TC5: username=null
     */
    it('[TC5] Yêu cầu có username=null → server map thành chuỗi rỗng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([
            mockRequest1,
            mockRequestInvalidUsername,
        ]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(2);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        const invalidEntry = result.data.find(
            (d: any) => (d as { request: { id: string } }).request.id === 'student-invalid',
        );
        expect(invalidEntry!.request.user_name).toBe('');
    });

    /**
     * TC6: Thứ tự thời gian
     */
    it('[TC6] Kết quả phải theo thứ tự mới nhất trước → server orderBy createdAt DESC', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest1, mockRequest2]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(2);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20);

        expect(result.data[0].request.id).toBe('student-1');
        expect(result.data[1].request.id).toBe('student-2');
        expect(mockPrisma.enrollmentRequest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
        );
    });

    /**
     * TC9: total server > data.length
     */
    it('[TC9] total server > data.length (còn trang sau) → app hiển thị total', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest1]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(50);

        const result = await service.getRequestedEnrollment('gv-token', 0, 1);

        expect(result.data).toHaveLength(1);
        expect(result.total).toBe(50);
    });

    /**
     * TC11: Pagination
     */
    it('[TC11] Pagination check skip correctly', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest2]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(25);

        await service.getRequestedEnrollment('gv-token', 1, 20);

        expect(mockPrisma.enrollmentRequest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 20, take: 20 }),
        );
    });

    it('[Bonus] DB lỗi khi findMany → throws Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.enrollmentRequest.findMany.mockRejectedValue(new Error('DB error'));

        await expect(service.getRequestedEnrollment('gv-token', 0, 20)).rejects.toThrow('DB error');
    });

    it('[Bonus] DB lỗi ngay khi tra cứu token → throws Error', async () => {
        mockPrisma.user.findFirst.mockRejectedValue(new Error('Connection timeout'));

        await expect(service.getRequestedEnrollment('gv-token', 0, 20)).rejects.toThrow(
            'Connection timeout',
        );
    });

    it('[Bonus] index hoặc count sai → throws ApiException INVALID_PARAMETER_VALUE', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);

        await expect(service.getRequestedEnrollment('gv-token', NaN, 20)).rejects.toThrow(
            ApiException,
        );
        await expect(service.getRequestedEnrollment('gv-token', 0, 0)).rejects.toThrow(
            ApiException,
        );
        await expect(service.getRequestedEnrollment('gv-token', -1, 20)).rejects.toThrow(
            ApiException,
        );
    });

    it('[Bonus] HV gọi API → throws ApiException NOT_ACCESS', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockHVUser);

        const call = () => service.getRequestedEnrollment('hv-token', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NOT_ACCESS);
        }
    });

    it('[Bonus] GV dùng user_id hợp lệ → xem enrollment của GV khác', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.user.findUnique.mockResolvedValue(mockTargetGV);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([mockRequest1]);
        mockPrisma.enrollmentRequest.count.mockResolvedValue(1);

        const result = await service.getRequestedEnrollment('gv-token', 0, 20, 'user-gv-target');

        expect(result.data).toHaveLength(1);
        expect(mockPrisma.enrollmentRequest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teacherId: 'user-gv-target' },
            }),
        );
    });
});
