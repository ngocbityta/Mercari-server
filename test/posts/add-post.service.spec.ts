import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { UserRole, UserStatus } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';

describe('PostsService - addPost', () => {
    let service: PostsService;

    const mockTeacher = {
        id: 'teacher-id',
        role: UserRole.GV,
        status: UserStatus.ACTIVE,
        token: 'teacher-token',
    };

    const mockStudent = {
        id: 'student-id',
        role: UserRole.HV,
        status: UserStatus.ACTIVE,
        token: 'student-token',
    };

    const mockExercisePost = {
        id: 'exercise-id',
        ownerId: 'teacher-id',
        owner: {
            id: 'teacher-id',
            role: UserRole.GV,
        },
    };

    const mockCreatedPost = {
        id: 'new-post-id',
    };

    const mockPrisma = {
        user: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
        },
        post: {
            findUnique: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PostsService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        jest.clearAllMocks();
    });

    it('[TC1] Giáo viên đăng bài thành công', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockTeacher);
        mockPrisma.post.create.mockResolvedValue(mockCreatedPost);

        const result = await service.addPost(
            'teacher-token',
            'v-left.mp4',
            'v-right.mp4',
            'test content',
            'slave-1',
        );

        expect(result.id).toBe('new-post-id');
        expect(mockPrisma.post.create).toHaveBeenCalled();
    });

    it('[HV-TC1] Học viên nộp bài tập thành công', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);
        mockPrisma.post.findUnique.mockResolvedValue(mockExercisePost);
        mockPrisma.post.create.mockResolvedValue(mockCreatedPost);

        const result = await service.addPost(
            'student-token',
            'v-left.mp4',
            'v-right.mp4',
            'student submission',
            'slave-1',
            'teacher-id', // course_id
            'exercise-id', // exercise_id
        );

        expect(result.id).toBe('new-post-id');
    });

    it('[HV-TC2] Học viên thiếu exercise_id/course_id trả về MISSING_PARAMETER', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);

        const call = () =>
            service.addPost(
                'student-token',
                'v-left.mp4',
                'v-right.mp4',
                'content',
                'slave-1',
                undefined,
                undefined,
            );

        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.MISSING_PARAMETER);
        }
    });

    it('[TC2] Token không hợp lệ trả về TOKEN_INVALID', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () =>
            service.addPost('invalid-token', 'v-left.mp4', 'v-right.mp4', 'content', 'slave-1');

        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    it('[TC4] Tài khoản bị khóa trả về ACCOUNT_LOCKED', async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ ...mockTeacher, status: UserStatus.LOCKED });

        const call = () =>
            service.addPost('teacher-token', 'v-left.mp4', 'v-right.mp4', 'content', 'slave-1');

        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    it('[HV-TC3] Nộp bài vào bài tập không tồn tại trả về POST_NOT_FOUND', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const call = () =>
            service.addPost(
                'student-token',
                'v-left.mp4',
                'v-right.mp4',
                'content',
                'slave-1',
                'teacher-id',
                'non-existent-id',
            );

        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.POST_NOT_FOUND);
        }
    });

    it('[HV-TC4] Nộp bài vào bài của học viên khác trả về INVALID_PARAMETER_VALUE', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);
        mockPrisma.post.findUnique.mockResolvedValue({
            ...mockExercisePost,
            owner: { role: UserRole.HV },
        });

        const call = () =>
            service.addPost(
                'student-token',
                'v-left.mp4',
                'v-right.mp4',
                'content',
                'slave-1',
                'other-student-id',
                'exercise-id',
            );

        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    it('[HV-TC5] course_id không khớp với chủ bài tập trả về INVALID_PARAMETER_VALUE', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockStudent);
        mockPrisma.post.findUnique.mockResolvedValue(mockExercisePost);

        const call = () =>
            service.addPost(
                'student-token',
                'v-left.mp4',
                'v-right.mp4',
                'content',
                'slave-1',
                'wrong-teacher-id',
                'exercise-id',
            );

        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    it('[TC5/6] Lỗi CSDL hoặc ngoại lệ trả về Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockTeacher);
        mockPrisma.post.create.mockRejectedValue(new Error('DB failure'));

        await expect(
            service.addPost('teacher-token', 'v-left.mp4', 'v-right.mp4', 'content', 'slave-1'),
        ).rejects.toThrow('DB failure');
    });
});
