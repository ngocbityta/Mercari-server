import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseCode } from '../../src/enums/response-code.enum';
import { User, Post, Block } from '@prisma/client';

interface PostResponse {
    code: string;
    message: string;
    data?: any;
}

describe('PostsService - getPost', () => {
    let service: PostsService;
    let prisma: PrismaService;

    const mockToken = 'valid_token';
    const mockUser = {
        id: 'user1',
        token: mockToken,
        status: 'ACTIVE',
        role: 'HV',
        username: 'User 1',
        avatar: 'avatar1.jpg',
        online: true,
    };
    const mockTeacher = {
        id: 'teacher1',
        token: 'teacher_token',
        status: 'ACTIVE',
        role: 'GV',
        username: 'Teacher 1',
        avatar: 'teacher_avatar.jpg',
    };
    const mockPost = {
        id: 'post1',
        ownerId: 'teacher1',
        content: 'Post content',
        media: ['video1.mp4'],
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        likeIds: [],
        commentIds: [],
        owner: mockTeacher,
        courseId: 'teacher1',
        exerciseId: 'ex1',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PostsService,
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findFirst: jest.fn(),
                            findUnique: jest.fn(),
                        },
                        post: {
                            findUnique: jest.fn(),
                        },
                        block: {
                            findFirst: jest.fn(),
                        },
                        comment: {
                            count: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        prisma = module.get<PrismaService>(PrismaService);
        jest.spyOn(prisma.comment, 'count').mockResolvedValue(0);
    });

    it('[TC1] should return post details successfully', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as unknown as Post);
        jest.spyOn(prisma.block, 'findFirst').mockResolvedValue(null);
        jest.spyOn(prisma.comment, 'count').mockResolvedValue(0);

        const result = (await service.getPost(mockToken, 'post1')) as PostResponse;

        expect(result.code).toBe(ResponseCode.OK);
        expect(result.data.id).toBe('post1');
        expect(result.data.author.name).toBe('Teacher 1');
    });

    it('[TC2] should return 9998 if token is invalid', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

        const result = await service.getPost('invalid', 'post1');

        expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
    });

    it('[TC3] should return 9992 if post is locked', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue({
            ...mockPost,
            isLocked: true,
        } as unknown as Post);

        const result = (await service.getPost(mockToken, 'post1')) as PostResponse;

        expect(result.code).toBe(ResponseCode.POST_NOT_FOUND);
    });

    it('[TC4] should return is_blocked: 1 and empty fields if blocked', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as unknown as Post);
        jest.spyOn(prisma.block, 'findFirst').mockResolvedValue({ id: 'b1' } as unknown as Block);

        const result = (await service.getPost(mockToken, 'post1')) as PostResponse;

        expect(result.code).toBe(ResponseCode.OK);
        expect(result.data.is_blocked).toBe('1');
        expect(result.data.described).toBe('');
        expect(result.data.video).toEqual([]);
    });

    it('[TC9] should use defaults if author name or avatar is missing', async () => {
        const postWithIncompleteAuthor = {
            ...mockPost,
            owner: { ...mockTeacher, username: '', avatar: '' },
        };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(
            postWithIncompleteAuthor as unknown as Post,
        );
        jest.spyOn(prisma.block, 'findFirst').mockResolvedValue(null);

        const result = (await service.getPost(mockToken, 'post1')) as PostResponse;

        expect(result.data.author.name).toBe('Người dùng');
        expect(result.data.author.avatar).toBe('default_avatar.jpg');
    });

    it('[TC10] should return 9992 if post ID is wrong', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(null);

        const result = await service.getPost(mockToken, 'wrong_id');

        expect(result.code).toBe(ResponseCode.POST_NOT_FOUND);
    });

    it('[GV-Admin] GV should be able to impersonate user view', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockTeacher as unknown as User); // Requester is GV
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as unknown as User); // Target user
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as unknown as Post);
        jest.spyOn(prisma.block, 'findFirst').mockResolvedValue(null);

        const result = (await service.getPost('teacher_token', 'post1', 'user1')) as PostResponse;

        expect(result.code).toBe(ResponseCode.OK);
        // Should return time_series_poses since effective viewer is HV (mockUser)
        // and post owner is GV (mockTeacher)
        expect(result.data.time_series_poses).toBeDefined();
    });
});
