import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseCode } from '../../src/enums/response-code.enum';
import { User, Post } from '@prisma/client';

describe('PostsService - editPost', () => {
    let service: PostsService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PostsService,
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findFirst: jest.fn(),
                        },
                        post: {
                            findUnique: jest.fn(),
                            count: jest.fn(),
                            update: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    const mockToken = 'valid_token';
    const mockPostId = 'post1';
    const mockUser: Partial<User> = {
        id: 'gv1',
        role: 'GV',
        status: 'ACTIVE',
        token: mockToken,
    };
    const mockPost: Partial<Post> = {
        id: mockPostId,
        ownerId: 'gv1',
        content: 'Old content',
        media: ['v1.mp4'],
        leftVideo: 'v1.mp4',
    };

    it('[TC1] should edit post successfully when parameters are valid', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as Post);
        jest.spyOn(prisma.post, 'count').mockResolvedValue(0); // No submissions
        jest.spyOn(prisma.post, 'update').mockResolvedValue({ id: mockPostId } as Post);

        const result = await service.editPost(mockToken, mockPostId, 'New content');
        expect(result.code).toBe(ResponseCode.OK);
        expect(result.data?.id).toBe(mockPostId);
    });

    it('[TC2] should return TOKEN_INVALID when token is wrong', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
        const result = await service.editPost('wrong_token', mockPostId, 'New content');
        expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
    });

    it('[TC5] should return ACCOUNT_LOCKED when account is locked', async () => {
        const lockedUser = { ...mockUser, status: 'LOCKED' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(lockedUser as User);
        const result = await service.editPost(mockToken, mockPostId, 'New content');
        expect(result.code).toBe(ResponseCode.ACCOUNT_LOCKED);
    });

    it('should return NOT_ACCESS when non-teacher tries to edit', async () => {
        const hvUser = { ...mockUser, role: 'HV' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(hvUser as any);
        const result = await service.editPost(mockToken, mockPostId, 'New content');
        expect(result.code).toBe(ResponseCode.NOT_ACCESS);
    });

    it('should return POST_NOT_FOUND when post does not exist', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(null);
        const result = await service.editPost(mockToken, 'non_existent', 'New content');
        expect(result.code).toBe(ResponseCode.POST_NOT_FOUND);
    });

    it('should return NOT_ACCESS when editing post of another user', async () => {
        const otherPost = { ...mockPost, ownerId: 'other_gv' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(otherPost as Post);
        const result = await service.editPost(mockToken, mockPostId, 'New content');
        expect(result.code).toBe(ResponseCode.NOT_ACCESS);
    });

    it('should return ACTION_DONE_PREVIOUSLY when students have already submitted (Image 36 rule)', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as Post);
        jest.spyOn(prisma.post, 'count').mockResolvedValue(1); // 1 HV has submitted

        const result = await service.editPost(mockToken, mockPostId, 'New content');
        expect(result.code).toBe(ResponseCode.ACTION_DONE_PREVIOUSLY);
        expect(result.message).toContain('students have already submitted');
    });

    it('[TC6/7] should return INVALID_PARAMETER_VALUE when deleting video without replacement', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as Post);
        jest.spyOn(prisma.post, 'count').mockResolvedValue(0);

        // Request delete left video but no provided left_video
        const result = await service.editPost(mockToken, mockPostId, undefined, 'L');
        expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        expect(result.message).toContain('replacement video');
    });

    it('should successfully update video when indices and replacement match', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as Post);
        jest.spyOn(prisma.post, 'count').mockResolvedValue(0);
        const updateSpy = jest
            .spyOn(prisma.post, 'update')
            .mockResolvedValue({ id: mockPostId } as Post);

        await service.editPost(mockToken, mockPostId, undefined, 'L', 'new_l.mp4');

        expect(updateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    leftVideo: 'new_l.mp4',
                }),
            }),
        );
    });
});
