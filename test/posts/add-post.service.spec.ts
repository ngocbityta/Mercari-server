import { EventsGateway } from '../../src/events/events.gateway.ts';
import { SearchService } from '../../src/search/search.service.ts';
import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { UserRole, UserStatus } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { MediaService } from '../../src/posts/media.service';

const SYSTEM_BOT_USER_ID = '00000000-0000-0000-0000-000000000001';

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

    const mockMediaService = {
        uploadFile: jest.fn().mockResolvedValue('http://download-url.com/video'),
        generateAndUploadThumbnail: jest
            .fn()
            .mockResolvedValue('http://download-url.com/thumbnail'),
    };

    const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.mp4',
        mimetype: 'video/mp4',
    } as Express.Multer.File;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PostsService,
                { provide: EventsGateway, useValue: { emitNotification: jest.fn() } },
                {
                    provide: SearchService,
                    useValue: {
                        indexPost: jest.fn(),
                        removePost: jest.fn(),
                        searchPosts: jest.fn(),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: MediaService,
                    useValue: mockMediaService,
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
            mockFile,
            mockFile,
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
            mockFile,
            mockFile,
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
                mockFile,
                mockFile,
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
            service.addPost('invalid-token', mockFile, mockFile, 'content', 'slave-1');

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
            service.addPost('teacher-token', mockFile, mockFile, 'content', 'slave-1');

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
                mockFile,
                mockFile,
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
                mockFile,
                mockFile,
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
                mockFile,
                mockFile,
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
            service.addPost('teacher-token', mockFile, mockFile, 'content', 'slave-1'),
        ).rejects.toThrow('DB failure');
    });

    it('Thiếu left_video trả về MISSING_PARAMETER', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockTeacher);

        const call = () =>
            service.addPost('teacher-token', undefined, mockFile, 'content', 'slave-1');

        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.MISSING_PARAMETER);
        }
    });

    it('Thiếu right_video trả về MISSING_PARAMETER', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockTeacher);

        const call = () =>
            service.addPost('teacher-token', mockFile, undefined, 'content', 'slave-1');

        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.MISSING_PARAMETER);
        }
    });

    describe('triggerPoseGrading', () => {
        let originalFetch: typeof global.fetch;

        beforeAll(() => {
            originalFetch = global.fetch;
        });

        afterAll(() => {
            global.fetch = originalFetch;
        });

        it('should trigger pose grading for left/right videos, calculate average, and create comment authored by student', async () => {
            const studentPostMock = {
                id: 'student-post-id',
                exerciseId: 'teacher-exercise-id',
                leftVideo: 'http://localhost:3000/it4788/videos/vid_student_left/stream',
                rightVideo: 'http://localhost:3000/it4788/videos/vid_student_right/stream',
                ownerId: 'student-id',
            };
            const teacherPostMock = {
                id: 'teacher-exercise-id',
                leftVideo: 'http://localhost:3000/it4788/videos/vid_teacher_left/stream',
                rightVideo: 'http://localhost:3000/it4788/videos/vid_teacher_right/stream',
                ownerId: 'teacher-id',
            };

            mockPrisma.post.findUnique
                .mockResolvedValueOnce(studentPostMock)
                .mockResolvedValueOnce(teacherPostMock);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (mockPrisma as any).comment = {
                create: jest.fn().mockResolvedValue({ id: 'comment-id' }),
            };

            const mockFetch = jest.fn();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ job_id: 'job-left', status: 'queued' }),
            } as Response);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ job_id: 'job-right', status: 'queued' }),
            } as Response);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        status: 'success',
                        job_output: { score: 8.0, raw_distance: 0.2 },
                    }),
            } as Response);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        status: 'success',
                        job_output: { score: 9.0, raw_distance: 0.1 },
                    }),
            } as Response);

            global.fetch = mockFetch;

            await service.triggerPoseGrading('student-post-id');

            expect(mockFetch).toHaveBeenCalledTimes(4);

            expect(mockFetch).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('/v1/pose-grade/jobs'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        source_video_id_a: 'vid_teacher_left',
                        source_video_id_b: 'vid_student_left',
                    }),
                }),
            );

            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('/v1/pose-grade/jobs'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        source_video_id_a: 'vid_teacher_right',
                        source_video_id_b: 'vid_student_right',
                    }),
                }),
            );

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect((mockPrisma as any).comment.create).toHaveBeenCalledWith({
                data: {
                    postId: 'student-post-id',
                    authorId: SYSTEM_BOT_USER_ID,
                    score: '8.5',
                    detailMistakes: 'Left video raw distance: 0.2. Right video raw distance: 0.1.',
                },
            });
        });
    });
});
