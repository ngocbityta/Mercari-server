import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { Post, User } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';

describe('PostsService - getListPosts', () => {
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
                            count: jest.fn(),
                        },
                        block: {
                            findFirst: jest.fn(),
                            findMany: jest.fn(),
                        },
                        enrollment: {
                            findMany: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        prisma = module.get<PrismaService>(PrismaService);

        // Default mock implementation
        jest.spyOn(prisma.block, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.enrollment, 'findMany').mockResolvedValue([]);
        jest.spyOn(prisma.post, 'count').mockResolvedValue(0);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // Test Case 1: Thành công
    it('[TC1] should return posts when parameters are valid', async () => {
        const mockUser = { id: 'user1', token: 'valid_token', status: 'ACTIVE', role: 'HV' };
        const mockPosts = [
            {
                id: 'post1',
                content: 'Hello',
                media: [],
                createdAt: new Date(),
                likeIds: [],
                commentIds: [],
                ownerId: 'user1',
                owner: mockUser,
            },
        ];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue(mockPosts as unknown as Post[]);
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(null);

        const result = await service.getListPosts('valid_token');
        expect(result.posts).toHaveLength(1);
    });

    // Test Case 2: Sai mã phiên đăng nhập (Token invalid)
    it('[TC2] should throw ApiException (TOKEN_INVALID) when token is empty or wrong', async () => {
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

        const call = () => service.getListPosts('wrong_token');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    // Test Case 3: Không còn bài viết nào
    it('[TC3] should throw ApiException (NO_DATA) when no posts found', async () => {
        const mockUser = { id: 'user1', token: 'valid_token', status: 'ACTIVE' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue([]);

        const call = () => service.getListPosts('valid_token', undefined, undefined, 0);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
        }
    });

    // Test Case 4: Người dùng bị hệ thống chặn (Account Locked)
    it('[TC4] should throw ApiException (ACCOUNT_LOCKED) when requester is banned', async () => {
        const mockUser = { id: 'user1', token: 'banned_token', status: 'LOCKED' };
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);

        const call = () => service.getListPosts('banned_token');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    // Test Case 6: Trường like/comment bị lỗi (sử dụng giá trị mặc định)
    it('[TC6] should use default values for counts when data is missing', async () => {
        const mockUser = { id: 'user1', token: 'token', status: 'ACTIVE' };
        const mockPosts = [
            {
                id: 'post1',
                content: 'Hello',
                media: [],
                createdAt: new Date(),
                likeIds: null,
                commentIds: undefined,
                ownerId: 'user1',
                owner: mockUser,
            },
        ];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue(mockPosts as unknown as Post[]);

        const result = await service.getListPosts('token');
        expect(result.posts[0].like).toBe('0');
        expect(result.posts[0].comment).toBe('0');
    });

    // Test Case 9: Cả described và video đều lỗi (Ẩn bài viết)
    it('[TC9] should throw ApiException (NO_DATA) when both content and media are empty', async () => {
        const mockUser = { id: 'user1', token: 'token', status: 'ACTIVE' };
        const mockPosts = [
            {
                id: 'post_broken',
                content: '',
                media: [],
                createdAt: new Date(),
                ownerId: 'user1',
                owner: mockUser,
            },
        ];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue(mockPosts as unknown as Post[]);

        const call = () => service.getListPosts('token');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
        }
    });

    // Test Case 10: Một trong hai trường lỗi (Vẫn hiển thị)
    it('[TC10] should display post if only one of content or media is faulty', async () => {
        const mockUser = { id: 'user1', token: 'token', status: 'ACTIVE' };
        const mockPosts = [
            {
                id: 'post_partial',
                content: 'Partial info',
                media: [],
                createdAt: new Date(),
                ownerId: 'user1',
                owner: mockUser,
            },
        ];

        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
        jest.spyOn(prisma.post, 'findMany').mockResolvedValue(mockPosts as unknown as Post[]);

        const result = await service.getListPosts('token');
        expect(result.posts).toHaveLength(1);
        expect(result.posts[0].described).toBe('Partial info');
    });
});
