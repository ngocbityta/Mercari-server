import { EventsGateway } from '../../src/events/events.gateway.ts';
import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { MediaService } from '../../src/posts/media.service.ts';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

// --- Mock data ---
const mockStudent = {
    id: 'student-1',
    role: 'HV',
    status: 'ACTIVE',
    token: 'student-token',
};

const mockLockedStudent = { ...mockStudent, status: 'LOCKED', token: 'locked-token' };

const mockTeacherA = {
    id: 'teacher-a',
    username: 'Giang Vien A',
    avatar: 'teacher-a-avatar.jpg',
    role: 'GV',
    status: 'ACTIVE',
};

const mockTeacherB = {
    id: 'teacher-b',
    username: 'Giang Vien B',
    avatar: 'teacher-b-avatar.jpg',
    role: 'GV',
    status: 'ACTIVE',
};

const mockPost1 = {
    id: 'post-1',
    ownerId: 'teacher-a',
    content: 'Introduction to yoga',
    leftVideo: 'left-video-1.mp4',
    rightVideo: 'right-video-1.mp4',
    createdAt: new Date('2026-05-18T10:00:00Z'),
    owner: mockTeacherA,
};

const mockPost2 = {
    id: 'post-2',
    ownerId: 'teacher-b',
    content: 'Advanced gymnastics',
    leftVideo: 'left-video-2.mp4',
    rightVideo: null,
    createdAt: new Date('2026-05-17T10:00:00Z'),
    owner: mockTeacherB,
};

const mockPrisma = {
    user: { findFirst: jest.fn() },
    block: { findMany: jest.fn() },
    post: { findMany: jest.fn(), count: jest.fn() },
    enrollment: { findMany: jest.fn() },
    enrollmentRequest: { findMany: jest.fn() },
};

describe('CoursesService - getListCourses', () => {
    let service: CoursesService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CoursesService,
                { provide: EventsGateway, useValue: { emitNotification: jest.fn() } },
                { provide: PrismaService, useValue: mockPrisma },
                {
                    provide: MediaService,
                    useValue: { getProxiedUrl: jest.fn((url) => `proxied_${url}`) },
                },
            ],
        }).compile();

        service = module.get<CoursesService>(CoursesService);
        jest.clearAllMocks();
    });

    /**
     * TC1: Lấy danh sách thành công
     */
    it('[TC1] Lấy danh sách khóa học thành công -> trả về đúng cấu trúc', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.post.findMany.mockResolvedValue([mockPost1, mockPost2]);
        mockPrisma.post.count.mockResolvedValue(2);
        mockPrisma.enrollment.findMany.mockResolvedValue([{ teacherId: 'teacher-a' }]);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([]);

        const result = await service.getListCourses('student-token', 0, 10);

        expect(result.total).toBe('2');
        expect(result.courses).toHaveLength(2);

        // Verify structure mapping
        expect(result.courses[0]).toEqual({
            course_id: 'teacher-a',
            description: 'Introduction to yoga',
            username: 'Giang Vien A',
            avatar: 'teacher-a-avatar.jpg',
            left_video: 'proxied_left-video-1.mp4',
            right_video: 'proxied_right-video-1.mp4',
            is_enrolled: '1',
            is_requested: '0',
        });

        expect(result.courses[1]).toEqual({
            course_id: 'teacher-b',
            description: 'Advanced gymnastics',
            username: 'Giang Vien B',
            avatar: 'teacher-b-avatar.jpg',
            left_video: 'proxied_left-video-2.mp4',
            right_video: '',
            is_enrolled: '0',
            is_requested: '0',
        });
    });

    /**
     * TC2: Token không hợp lệ
     */
    it('[TC2] Token sai -> ném lỗi TOKEN_INVALID', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.getListCourses('bad-token', 0, 10);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    /**
     * TC3: Tài khoản bị khóa
     */
    it('[TC3] Tài khoản bị khóa -> ném lỗi ACCOUNT_LOCKED', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedStudent);

        const call = () => service.getListCourses('locked-token', 0, 10);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    /**
     * TC4: Không có khóa học nào ở trang đầu (index = 0)
     */
    it('[TC4] Không có dữ liệu ở trang đầu -> ném lỗi NO_DATA', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.post.findMany.mockResolvedValue([]);
        mockPrisma.post.count.mockResolvedValue(0);
        mockPrisma.enrollment.findMany.mockResolvedValue([]);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([]);

        const call = () => service.getListCourses('student-token', 0, 10);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
        }
    });

    /**
     * TC5: Lỗi tham số phân trang không hợp lệ
     */
    it('[TC5] index âm hoặc count <= 0 -> ném lỗi INVALID_PARAMETER_VALUE', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);

        await expect(service.getListCourses('student-token', -1, 10)).rejects.toThrow(ApiException);
        await expect(service.getListCourses('student-token', 0, 0)).rejects.toThrow(ApiException);
        await expect(service.getListCourses('student-token', NaN, 10)).rejects.toThrow(
            ApiException,
        );
    });

    /**
     * TC6: Lọc bỏ Giảng viên bị chặn
     */
    it('[TC6] Lọc bỏ bài đăng của các Giảng viên có quan hệ block hai chiều', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);
        // Student chặn teacher-b
        mockPrisma.block.findMany.mockResolvedValue([
            { blockerId: 'student-1', blockedId: 'teacher-b' },
        ]);
        mockPrisma.post.findMany.mockResolvedValue([mockPost1]);
        mockPrisma.post.count.mockResolvedValue(1);
        mockPrisma.enrollment.findMany.mockResolvedValue([]);
        mockPrisma.enrollmentRequest.findMany.mockResolvedValue([]);

        const result = await service.getListCourses('student-token', 0, 10);

        expect(result.courses).toHaveLength(1);
        expect(result.courses[0].course_id).toBe('teacher-a');
        expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    ownerId: { notIn: ['teacher-b'] },
                }),
            }),
        );
    });
});
