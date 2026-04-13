import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { Post, User, Block } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';

describe('PostsService - searchPosts', () => {
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
                            findMany: jest.fn(),
                            findUnique: jest.fn(),
                        },
                        block: {
                            findFirst: jest.fn(),
                            findMany: jest.fn(),
                        },
                        searchHistory: {
                            create: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    const mockToken = 'valid_token';
    const mockKeyword = 'nest';

    it('[TC1] should return OK when parameters are valid', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        const mockPosts = [
            {
                id: 'post1',
                content: 'NestJS is great',
                media: ['video1.mp4'],
                createdAt: new Date(),
                ownerId: 'user2',
                owner: { id: 'user2', username: 'user2', status: 'ACTIVE' },
            },
        ];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue(mockPosts as unknown as Post[]);

        const result = await service.searchPosts(mockToken, mockKeyword, '0', '0', '0');
        expect(result.posts).toHaveLength(1);
    });

    it('[TC2] should throw TOKEN_INVALID when token is wrong', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

        const call = () => service.searchPosts('wrong_token', mockKeyword, '0', '0', '0');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    it('[TC3] should throw NO_DATA when no results found', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue([]);

        const call = () => service.searchPosts(mockToken, 'randomkeyword', '0', '0', '0');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
        }
    });

    it('[TC4] should throw ACCOUNT_LOCKED when requester is banned', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'LOCKED' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);

        const call = () => service.searchPosts(mockToken, mockKeyword, '0', '0', '0');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    it('[TC5] should throw INVALID_PARAMETER_VALUE when target user_id not exists', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

        const call = () =>
            service.searchPosts(mockToken, mockKeyword, '0', '0', '0', 'non_existent_user');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    it('[TC6] should throw INVALID_PARAMETER_VALUE when keyword is missing', async () => {
        const call = () => service.searchPosts(mockToken, '', '0', '0', '0');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    it('[TC13] should throw INVALID_PARAMETER_VALUE when index or count is invalid', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);

        const call = () =>
            service.searchPosts(mockToken, mockKeyword, '0', '0', '0', undefined, -1, 10);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    it('[TC_BLOCK] should filter out posts from blocked users', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        const mockBlocks = [{ blockerId: 'user1', blockedId: 'blocked_user' }];
        const mockPosts = [
            {
                id: 'post1',
                content: 'NestJS is great',
                media: ['video1.mp4'],
                createdAt: new Date(),
                ownerId: 'user2',
                owner: { id: 'user2', username: 'user2', status: 'ACTIVE' },
            },
        ];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue(mockBlocks as unknown as Block[]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const findManySpy = jest.spyOn(prisma.post, 'findMany').mockResolvedValue(mockPosts as any);

        await service.searchPosts(mockToken, mockKeyword, '0', '0', '0');

        expect(findManySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                where: expect.objectContaining({
                    ownerId: { notIn: ['blocked_user'] },
                }),
            }),
        );
    });
});
