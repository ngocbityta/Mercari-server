import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseCode } from '../../src/enums/response-code.enum';
import { Post, User, Block, Prisma } from '@prisma/client';

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
        expect(result.code).toBe(ResponseCode.OK);
        expect(result.data?.posts).toHaveLength(1);
    });

    it('[TC2] should return TOKEN_INVALID when token is wrong', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
        const result = await service.searchPosts('wrong_token', mockKeyword, '0', '0', '0');
        expect(result.code).toBe(ResponseCode.TOKEN_INVALID);
    });

    it('[TC3] should return NO_DATA when no results found', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue([]);

        const result = await service.searchPosts(mockToken, 'randomkeyword', '0', '0', '0');
        expect(result.code).toBe(ResponseCode.NO_DATA);
    });

    it('[TC4] should return ACCOUNT_LOCKED when requester is banned', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'LOCKED' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);

        const result = await service.searchPosts(mockToken, mockKeyword, '0', '0', '0');
        expect(result.code).toBe(ResponseCode.ACCOUNT_LOCKED);
    });

    it('[TC5] should return INVALID_PARAMETER_VALUE when target user_id not exists', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

        const result = await service.searchPosts(
            mockToken,
            mockKeyword,
            '0',
            '0',
            '0',
            'non_existent_user',
        );
        expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
    });

    it('[TC6] should return INVALID_PARAMETER_VALUE when keyword is missing', async () => {
        const result = await service.searchPosts(mockToken, '', '0', '0', '0');
        expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
    });

    it('[TC13] should return INVALID_PARAMETER_VALUE when index or count is invalid', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);

        const result = await service.searchPosts(
            mockToken,
            mockKeyword,
            '0',
            '0',
            '0',
            undefined,
            -1,
            10,
        );
        expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
    });

    it('[TC_BLOCK] should filter out posts from blocked users', async () => {
        const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE' };
        const mockBlocks = [{ blockerId: 'user1', blockedId: 'blocked_user' }];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue(mockBlocks as unknown as Block[]);
        const findManySpy = jest.spyOn(prisma.post, 'findMany').mockResolvedValue([]);

        await service.searchPosts(mockToken, mockKeyword, '0', '0', '0');

        expect(findManySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    ownerId: { notIn: ['blocked_user'] },
                } as unknown as Prisma.PostWhereInput),
            }),
        );
    });
});
