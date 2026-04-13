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

const mockLockedUser = { ...mockActiveUser, token: 'locked-token', status: 'LOCKED' };

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

// Comment vừa tạo bởi user-1
const mockMyComment = {
    id: 'comment-my',
    postId: 'post-1',
    authorId: 'user-1',
    content: 'Bình luận của tôi',
    score: null,
    detailMistakes: null,
    createdAt: new Date('2024-01-02T10:05:00Z'),
    author: { id: 'user-1', username: 'TestUser', avatar: 'avatar.jpg' },
};

// Comment từ người dùng khác (đã có trước)
const mockOtherComment = {
    id: 'comment-other',
    postId: 'post-1',
    authorId: 'user-2',
    content: 'Bình luận của người khác',
    score: null,
    detailMistakes: null,
    createdAt: new Date('2024-01-02T10:00:00Z'),
    author: { id: 'user-2', username: 'OtherUser', avatar: 'avatar2.jpg' },
};

// Comment score (chấm điểm AI)
const mockScoreComment = {
    id: 'comment-score',
    postId: 'post-1',
    authorId: 'user-1',
    content: null,
    score: '85',
    detailMistakes: '<table><tr><td>Lỗi tư thế</td></tr></table>',
    createdAt: new Date('2024-01-02T11:00:00Z'),
    author: { id: 'user-1', username: 'TestUser', avatar: 'avatar.jpg' },
};

const mockPrisma = {
    user: { findFirst: jest.fn() },
    post: { findUnique: jest.fn() },
    block: { findFirst: jest.fn(), findMany: jest.fn() },
    comment: { create: jest.fn(), findMany: jest.fn() },
};

describe('PostsService - setComment', () => {
    let service: PostsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PostsService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<PostsService>(PostsService);
        jest.clearAllMocks();
    });

    /**
     * TC1: Bình luận thành công
     */
    it('[TC1] Bình luận thành công', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([mockMyComment]);

        const result = await service.setComment(
            'valid-token',
            'post-1',
            0,
            20,
            'Bình luận của tôi',
        );

        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({
            id: 'comment-my',
            comment: 'Bình luận của tôi',
            poster: { id: 'user-1', name: 'TestUser' },
        });
        expect(result.is_blocked).toBe('0');
    });

    it('[TC1-score] Bình luận chấm điểm thành công', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockScoreComment);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([mockScoreComment]);

        await service.setComment(
            'valid-token',
            'post-1',
            0,
            20,
            undefined,
            '85',
            '<table><tr><td>Lỗi tư thế</td></tr></table>',
        );

        expect(mockPrisma.comment.create).toHaveBeenCalledWith({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: expect.objectContaining({
                score: '85',
                detailMistakes: '<table><tr><td>Lỗi tư thế</td></tr></table>',
            }),
        });
    });

    /**
     * TC2: Mã phiên đăng nhập sai
     */
    it('[TC2] Token sai / phiên cũ → throws ApiException (TOKEN_INVALID)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.setComment('token-sai', 'post-1', 0, 20, 'Bình luận');
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

        const call = () => service.setComment('valid-token', 'post-locked', 0, 20, 'Bình luận');
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

        const call = () => service.setComment('locked-token', 'post-1', 0, 20, 'Bình luận');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    /**
     * TC5: CSDL không truy cập được
     */
    it('[TC5] DB lỗi khi tạo comment → throws Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockRejectedValue(new Error('DB failure'));

        await expect(
            service.setComment('valid-token', 'post-1', 0, 20, 'Bình luận'),
        ).rejects.toThrow('DB failure');
    });

    /**
     * TC6: Post id không tồn tại
     */
    it('[TC6] Post id không tồn tại → throws ApiException (POST_NOT_FOUND)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const call = () => service.setComment('valid-token', 'post-999', 0, 20, 'Bình luận');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.POST_NOT_FOUND);
        }
    });

    /**
     * TC8: Thành công + hệ thống có thêm comment mới
     */
    it('[TC8] Có comment mới từ người khác', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([mockMyComment, mockOtherComment]);

        const result = await service.setComment(
            'valid-token',
            'post-1',
            0,
            20,
            'Bình luận của tôi',
        );

        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe('comment-my');
        expect(result.data[1].id).toBe('comment-other');
    });

    /**
     * TC9: Comment có người bị block
     */
    it('[TC9] Comment có người bị block → filter', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        mockPrisma.block.findMany.mockResolvedValue([
            { blockerId: 'commenter-blocked', blockedId: 'user-1' } as unknown as Block,
        ]);
        mockPrisma.comment.findMany.mockResolvedValue([]);

        const result = await service.setComment(
            'valid-token',
            'post-1',
            0,
            20,
            'Bình luận của tôi',
        );

        expect(result.data).toHaveLength(0);
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
     * TC10: Nội dung bình luận trống
     */
    it('[TC10a] Comment là chuỗi rỗng → throws ApiException (MISSING_PARAMETER)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const call = () => service.setComment('valid-token', 'post-1', 0, 20, '   ');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.MISSING_PARAMETER);
        }
    });

    it('[TC10b] Không truyền cả comment lẫn score → throws ApiException (MISSING_PARAMETER)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const call = () => service.setComment('valid-token', 'post-1', 0, 20);
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.MISSING_PARAMETER);
        }
    });

    it('[TC10c] Truyền cả comment lẫn score cùng lúc → throws ApiException (INVALID_PARAMETER_VALUE)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const call = () => service.setComment('valid-token', 'post-1', 0, 20, 'Bình luận', '85');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        }
    });

    /**
     * TC11: Chủ bài viết chặn người dùng
     */
    it('[TC11] Chủ bài viết block user giữa chừng → is_blocked="1"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue({
            blockerId: 'owner-1',
            blockedId: 'user-1',
        });
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([mockMyComment]);

        const result = await service.setComment('valid-token', 'post-1', 0, 20, 'Bình luận');

        expect(result.is_blocked).toBe('1');
    });

    /**
     * TC12: Commenter block user
     */
    it('[TC12] Commenter block user giữa chừng → server lọc comment đó', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        mockPrisma.block.findMany.mockResolvedValue([
            { blockerId: 'commenter-x', blockedId: 'user-1' } as any,
        ]);
        mockPrisma.comment.findMany.mockResolvedValue([mockMyComment]);

        const result = await service.setComment('valid-token', 'post-1', 0, 20, 'Bình luận');

        expect(result.is_blocked).toBe('0');
        expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                where: expect.objectContaining({
                    authorId: { notIn: ['commenter-x'] },
                }),
            }),
        );
    });
});
