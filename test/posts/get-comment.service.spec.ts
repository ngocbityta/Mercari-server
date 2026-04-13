import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { Block } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

// --- Mock data ---
const mockActiveUser = {
    id: 'user-1',
    phonenumber: '0901234567',
    password: 'abc123',
    username: 'TestUser',
    avatar: 'avatar.jpg',
    coverImage: null,
    description: null,
    role: 'HV',
    token: 'valid-token',
    height: null,
    status: 'ACTIVE',
    online: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockGVUser = {
    ...mockActiveUser,
    id: 'user-gv',
    role: 'GV',
    token: 'gv-token',
};

const mockLockedUser = {
    ...mockActiveUser,
    token: 'locked-token',
    status: 'LOCKED',
};

const mockTargetUser = {
    ...mockActiveUser,
    id: 'user-target',
    token: 'target-token',
};

const mockPost = {
    id: 'post-1',
    ownerId: 'owner-1',
    content: 'Bài test',
    media: [],
    hashtags: [],
    commentIds: [],
    likeIds: [],
    courseId: null,
    exerciseId: null,
    deviceMaster: '00000000-0000-0000-0000-000000000001',
    deviceSlave: null,
    leftVideo: null,
    rightVideo: null,
    isLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockLockedPost = { ...mockPost, isLocked: true };

const mockComments = [
    {
        id: 'comment-1',
        postId: 'post-1',
        authorId: 'commenter-1',
        content: 'Bình luận đầu tiên',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        author: { id: 'commenter-1', username: 'Commenter1', avatar: 'avatar1.jpg' },
    },
    {
        id: 'comment-2',
        postId: 'post-1',
        authorId: 'commenter-2',
        content: 'Bình luận thứ hai',
        createdAt: new Date('2024-01-01T09:00:00Z'),
        author: { id: 'commenter-2', username: 'Commenter2', avatar: 'avatar2.jpg' },
    },
];

const mockPrisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    post: { findUnique: jest.fn() },
    block: { findFirst: jest.fn(), findMany: jest.fn() },
    comment: { findMany: jest.fn() },
};

describe('PostsService - getComment', () => {
    let service: PostsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PostsService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<PostsService>(PostsService);
        jest.clearAllMocks();
    });

    /**
     * TC1: Lấy danh sách comment thành công
     */
    it('[TC1] Lấy comment thành công', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue(mockComments);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toMatchObject({
            id: 'comment-1',
            comment: 'Bình luận đầu tiên',
            poster: { id: 'commenter-1', name: 'Commenter1', avatar: 'avatar1.jpg' },
        });
        expect(result.is_blocked).toBe('0');
    });

    /**
     * TC2: Token không hợp lệ
     */
    it('[TC2] Token không hợp lệ → throws ApiException (TOKEN_INVALID)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.getComment('invalid-token', 'post-1', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    /**
     * TC3: Bài viết bị khóa
     */
    it('[TC3] Bài viết bị khóa → throws ApiException (ACTION_DONE_PREVIOUSLY)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockLockedPost);

        const call = () => service.getComment('valid-token', 'post-locked', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACTION_DONE_PREVIOUSLY);
        }
    });

    /**
     * TC4: Tài khoản bị khóa
     */
    it('[TC4] Tài khoản bị khóa → throws ApiException (ACCOUNT_LOCKED)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedUser);

        const call = () => service.getComment('locked-token', 'post-1', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    /**
     * TC5: Lỗi DB
     */
    it('[TC5] DB lỗi khi query block → throws Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockRejectedValue(new Error('DB failure'));

        await expect(service.getComment('valid-token', 'post-1', 0, 20)).rejects.toThrow(
            'DB failure',
        );
    });

    /**
     * TC6: Post id không tồn tại
     */
    it('[TC6] Post không tồn tại → throws ApiException (POST_NOT_FOUND)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const call = () => service.getComment('valid-token', 'post-999', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.POST_NOT_FOUND);
        }
    });

    /**
     * TC7-extra: Bài viết chưa có comment nào (index = 0)
     */
    it('[TC7-extra] Bài viết chưa có comment nào → throws ApiException (NO_DATA)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([]);

        const call = () => service.getComment('valid-token', 'post-1', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
        }
    });

    /**
     * TC8: Phân trang
     */
    it('[TC8] Phân trang trang cuối', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([mockComments[0], mockComments[1]]);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.data).toHaveLength(2);
    });

    /**
     * TC9: Lọc bình luận từ người bị block
     */
    it('[TC9a] Lọc comment từ user bị block', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockResolvedValue([
            { blockerId: 'commenter-blocked', blockedId: 'user-1' } as unknown as Block,
        ]);
        mockPrisma.comment.findMany.mockResolvedValue([mockComments[0]]);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.data).toHaveLength(1);
        expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                where: expect.objectContaining({
                    authorId: { notIn: ['commenter-blocked'] },
                }),
            }),
        );
    });

    /**
     * TC10: index hoặc count bị sai
     */
    it('[TC10a] index không phải số (NaN) → throws ApiException (INVALID_PARAMETER_VALUE)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const call = () => service.getComment('valid-token', 'post-1', NaN, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    it('[TC10b] count = 0 → throws ApiException (INVALID_PARAMETER_VALUE)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const call = () => service.getComment('valid-token', 'post-1', 0, 0);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    /**
     * Bonus: user_id param nhưng requester không phải GV
     */
    it('[Bonus-TC] user_id param nhưng requester không phải GV → throws ApiException (NOT_ACCESS)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);

        const call = () => service.getComment('valid-token', 'post-1', 0, 20, 'user-target');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.NOT_ACCESS);
        }
    });

    /**
     * TC11: Chủ bài viết block viewer
     */
    it('[TC11] Chủ bài viết block viewer → is_blocked="1"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue({
            blockerId: 'owner-1',
            blockedId: 'user-1',
        });
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue(mockComments);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.data).toHaveLength(2);
        expect(result.is_blocked).toBe('1');
    });

    /**
     * Bonus: GV dùng user_id hợp lệ
     */
    it('[Bonus] GV dùng user_id hợp lệ → viewer là user_id', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser);
        mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue(mockComments);

        const result = await service.getComment('gv-token', 'post-1', 0, 20, 'user-target');

        expect(result.data).toHaveLength(2);
        expect(mockPrisma.block.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                where: expect.objectContaining({
                    OR: [{ blockerId: 'user-target' }, { blockedId: 'user-target' }],
                }),
            }),
        );
    });
});
