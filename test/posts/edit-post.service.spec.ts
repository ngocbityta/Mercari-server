import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { User, Post } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';

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
                            findUnique: jest.fn(),
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
        jest.spyOn(prisma.post, 'count').mockResolvedValue(0);
        jest.spyOn(prisma.post, 'update').mockResolvedValue({ id: mockPostId } as Post);

        const result = await service.editPost(mockToken, mockPostId, 'New content');
        expect(result.id).toBe(mockPostId);
    });

    it('[TC2] should throw ApiException (TOKEN_INVALID) when token is wrong', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
        const call = () => service.editPost('wrong_token', mockPostId, 'New content');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    it('[TC5] should throw ApiException (ACCOUNT_LOCKED) when account is locked', async () => {
        const lockedUser = { ...mockUser, status: 'LOCKED' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(lockedUser as User);
        const call = () => service.editPost(mockToken, mockPostId, 'New content');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    it('should throw ApiException (NOT_ACCESS) when non-teacher tries to edit', async () => {
        const hvUser = { ...mockUser, role: 'HV' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(hvUser as any);
        const call = () => service.editPost(mockToken, mockPostId, 'New content');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NOT_ACCESS);
        }
    });

    it('should throw ApiException (POST_NOT_FOUND) when post does not exist', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(null);
        const call = () => service.editPost(mockToken, 'non_existent', 'New content');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.POST_NOT_FOUND);
        }
    });

    it('should throw ApiException (NOT_ACCESS) when editing post of another user', async () => {
        const otherPost = { ...mockPost, ownerId: 'other_gv' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(otherPost as Post);
        const call = () => service.editPost(mockToken, mockPostId, 'New content');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NOT_ACCESS);
        }
    });

    it('should throw ApiException (ACTION_DONE_PREVIOUSLY) when students have already submitted', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as Post);
        jest.spyOn(prisma.post, 'count').mockResolvedValue(1);

        const call = () => service.editPost(mockToken, mockPostId, 'New content');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACTION_DONE_PREVIOUSLY);
        }
    });

    it('[TC6/7] should throw ApiException (INVALID_PARAMETER_VALUE) when deleting video without replacement', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as User);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockPost as Post);
        jest.spyOn(prisma.post, 'count').mockResolvedValue(0);

        const call = () => service.editPost(mockToken, mockPostId, undefined, 'L');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data: expect.objectContaining({
                    leftVideo: 'new_l.mp4',
                }),
            }),
        );
    });
});
