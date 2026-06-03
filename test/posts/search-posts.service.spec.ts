import { EventsGateway } from '../../src/events/events.gateway.ts';
import { SearchService } from '../../src/search/search.service.ts';
import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { Post, User, Block } from '@prisma/client';
import { MediaService } from '../../src/posts/media.service';

describe('PostsService - searchPosts', () => {
    let service: PostsService;
    let prisma: PrismaService;

    const mockToken = 'valid_token';
    const mockKeyword = 'nest';

    const userA = { id: 'userA', token: mockToken, status: 'ACTIVE', role: 'HV' };
    const userB = { id: 'userB', token: 'token_B', status: 'ACTIVE', role: 'HV' };

    const makePost = (id: string, ownerId: string, content: string) => ({
        id,
        content,
        media: ['video.mp4'],
        createdAt: new Date(),
        likeIds: [],
        isLocked: false,
        leftVideo: null,
        rightVideo: null,
        leftVideoThumb: null,
        rightVideoThumb: null,
        ownerId,
        owner: { id: ownerId, username: `user_${ownerId}`, status: 'ACTIVE', role: 'HV' },
        _count: { comments: 0 },
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PostsService,
                { provide: EventsGateway, useValue: { emitNotification: jest.fn() } }, { provide: SearchService, useValue: { indexPost: jest.fn(), removePost: jest.fn(), searchPosts: jest.fn() } },
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findFirst: jest.fn(),
                            findUnique: jest.fn(),
                            findMany: jest.fn(),
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
                {
                    provide: MediaService,
                    useValue: {
                        uploadFile: jest.fn(),
                        getProxiedUrl: jest.fn((url: string) => url),
                        getVideoResponse: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        prisma = module.get<PrismaService>(PrismaService);

        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.block, 'findFirst').mockResolvedValue(null);
        jest.spyOn(prisma.searchHistory, 'create').mockResolvedValue({} as any);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
    });

    it('[TC1] should return posts when parameters are valid', async () => {
        const mockPost = makePost('post1', userB.id, 'NestJS is great');

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(userA as unknown as User);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue([mockPost] as unknown as Post[]);

        const result = await service.searchPosts(
            mockToken,
            mockKeyword,
            undefined,
            undefined,
            undefined,
            undefined,
            '0',
            '10',
        );

        expect(result.posts).toHaveLength(1);
    });

    it('[TC2] should throw TOKEN_INVALID when token is wrong', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

        await expect(
            service.searchPosts(
                'wrong_token',
                mockKeyword,
                undefined,
                undefined,
                undefined,
                undefined,
                '0',
                '10',
            ),
        ).rejects.toMatchObject({ code: ResponseCode.TOKEN_INVALID });
    });

    it('[TC3] should throw NO_DATA when no results found', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(userA as unknown as User);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue([]);

        await expect(
            service.searchPosts(
                mockToken,
                'randomkeyword',
                undefined,
                undefined,
                undefined,
                undefined,
                '0',
                '10',
            ),
        ).rejects.toMatchObject({ code: ResponseCode.NO_DATA });
    });

    it('[TC4] should throw ACCOUNT_LOCKED when requester is banned', async () => {
        const lockedUser = { ...userA, status: 'LOCKED' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(lockedUser as unknown as User);

        await expect(
            service.searchPosts(
                mockToken,
                mockKeyword,
                undefined,
                undefined,
                undefined,
                undefined,
                '0',
                '10',
            ),
        ).rejects.toMatchObject({ code: ResponseCode.ACCOUNT_LOCKED });
    });

    it('[TC6] should throw INVALID_PARAMETER_VALUE when keyword is empty', async () => {
        await expect(
            service.searchPosts(
                mockToken,
                '',
                undefined,
                undefined,
                undefined,
                undefined,
                '0',
                '10',
            ),
        ).rejects.toMatchObject({ code: ResponseCode.INVALID_PARAMETER_VALUE });
    });

    it('[TC13] should throw INVALID_PARAMETER_VALUE when index is negative', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(userA as unknown as User);

        await expect(
            service.searchPosts(
                mockToken,
                mockKeyword,
                undefined,
                undefined,
                undefined,
                undefined,
                '-1',
                '10',
            ),
        ).rejects.toMatchObject({ code: ResponseCode.INVALID_PARAMETER_VALUE });
    });

    it('[TC_BLOCK_OLD] should pass notIn blockedIds to query when user has blocks', async () => {
        const blocks = [{ blockerId: userA.id, blockedId: 'blocked_user' }];
        const mockPost = makePost('post1', userB.id, 'NestJS is great');

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(userA as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue(blocks as unknown as Block[]);
        const findManySpy = jest
            .spyOn(prisma.post, 'findMany')
            .mockResolvedValue([mockPost] as unknown as Post[]);

        await service.searchPosts(
            mockToken,
            mockKeyword,
            undefined,
            undefined,
            undefined,
            undefined,
            '0',
            '10',
        );

        expect(findManySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    content: { contains: mockKeyword, mode: 'insensitive' },
                    ownerId: { notIn: ['blocked_user'] },
                }),
            }),
        );
    });

    // ─── New test cases ───────────────────────────────────────────────────────

    it('[TC_SEARCH_1] user A finds posts of user B when there is no block', async () => {
        const postByB = makePost('post_b', userB.id, 'NestJS tutorial');

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(userA as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.block, 'findFirst').mockResolvedValue(null);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue([postByB] as unknown as Post[]);

        const result = await service.searchPosts(
            mockToken,
            'NestJS',
            undefined,
            undefined,
            undefined,
            '0',
            '10',
        );

        expect(result.posts).toHaveLength(1);
        expect(result.posts[0]!.author.id).toBe(userB.id);
    });

    it('[TC_SEARCH_2] user A cannot find posts of user B when A blocked B', async () => {
        const blocks = [{ blockerId: userA.id, blockedId: userB.id }];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(userA as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue(blocks as unknown as Block[]);
        const findManySpy = jest.spyOn(prisma.post, 'findMany').mockResolvedValue([]);

        await expect(
            service.searchPosts(
                mockToken,
                'NestJS',
                undefined,
                undefined,
                undefined,
                undefined,
                '0',
                '10',
            ),
        ).rejects.toMatchObject({ code: ResponseCode.NO_DATA });

        expect(findManySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    ownerId: { notIn: [userB.id] },
                }),
            }),
        );
    });

    it('[TC_SEARCH_3] user A cannot find posts of user B when B blocked A', async () => {
        const blocks = [{ blockerId: userB.id, blockedId: userA.id }];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(userA as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue(blocks as unknown as Block[]);
        const findManySpy = jest.spyOn(prisma.post, 'findMany').mockResolvedValue([]);

        await expect(
            service.searchPosts(
                mockToken,
                'NestJS',
                undefined,
                undefined,
                undefined,
                undefined,
                '0',
                '10',
            ),
        ).rejects.toMatchObject({ code: ResponseCode.NO_DATA });

        expect(findManySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    ownerId: { notIn: [userB.id] },
                }),
            }),
        );
    });
});
