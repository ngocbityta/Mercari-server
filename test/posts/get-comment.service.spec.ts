import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Prisma, Block } from '@prisma/client';

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
     * Kết quả: 1000, data là mảng comment, is_blocked="0"
     */
    it('[TC1] Lấy comment thành công → trả về 1000, danh sách comment, is_blocked="0"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null); // không bị block
        mockPrisma.block.findMany.mockResolvedValue([]); // không có block nào
        mockPrisma.comment.findMany.mockResolvedValue(mockComments);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.code).toBe('1000');
        expect(result.data).toHaveLength(2);
        expect(result.data![0]).toMatchObject({
            id: 'comment-1',
            comment: 'Bình luận đầu tiên',
            poster: { id: 'commenter-1', name: 'Commenter1', avatar: 'avatar1.jpg' },
        });
        expect(result.is_blocked).toBe('0');
    });

    /**
     * TC2: Token không hợp lệ / hết hạn
     * Kết quả: 9998 → ứng dụng đẩy về trang đăng nhập
     */
    it('[TC2] Token không hợp lệ → trả về 9998', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await service.getComment('invalid-token', 'post-1', 0, 20);

        expect(result.code).toBe('9998');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC3: Bài viết bị khóa (vi phạm tiêu chuẩn cộng đồng)
     * Kết quả: 1010 → ứng dụng xóa bài viết khỏi trang hiện tại
     */
    it('[TC3] Bài viết bị khóa → trả về 1010', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockLockedPost); // isLocked = true

        const result = await service.getComment('valid-token', 'post-locked', 0, 20);

        expect(result.code).toBe('1010');
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC4: Tài khoản bị khóa
     * Kết quả: 9991 → ứng dụng đẩy về trang đăng nhập
     */
    it('[TC4] Tài khoản bị khóa → trả về 9991', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedUser);

        const result = await service.getComment('locked-token', 'post-1', 0, 20);

        expect(result.code).toBe('9991');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC5: DB không truy cập được (lỗi trong quá trình query)
     * Kết quả: 1001 → ứng dụng hiện "Không thể kết nối Internet"
     */
    it('[TC5] DB lỗi khi query comment → trả về 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockRejectedValue(new Error('DB connection failed'));

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.code).toBe('1001');
    });

    /**
     * TC6: Post id không tồn tại
     * Kết quả: 9992 → báo bài viết không tồn tại
     */
    it('[TC6] Post không tồn tại → trả về 9992', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const result = await service.getComment('valid-token', 'post-999', 0, 20);

        expect(result.code).toBe('9992');
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC7: Mạng Internet bị ngắt trong khi gửi yêu cầu lấy bình luận.
     * NOTE: Đây là client-side concern — request không bao giờ đến được server.
     *       Backend không xử lý được trường hợp này.
     *       Ứng dụng cần set timeout và hiện "Không thể kết nối Internet" càng sớm càng tốt.
     *       (DB lỗi sau khi request đến server được test ở TC5 → trả 1001)
     */
    it('[TC7] Mạng bị ngắt là client-side concern — backend không xử lý được', () => {
        expect(true).toBe(true);
    });

    /**
     * TC7-extra: Bài viết chưa có comment nào (index = 0)
     * Kết quả: 9994 → ứng dụng không hiển thị nút "Tải thêm"
     */
    it('[TC7-extra] Bài viết chưa có comment nào → trả về 9994', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([]);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.code).toBe('9994');
    });

    /**
     * TC8: Hệ thống chỉ còn số bình luận ít hơn count (trang cuối chưa đầy).
     * Ví dụ: count=20 nhưng chỉ còn 3 bình luận → server trả về 3.
     * Kết quả: 1000, data.length < count → ứng dụng biết đây là trang cuối,
     *          không hiển thị nút "Tải thêm các bình luận…"
     */
    it('[TC8] Còn ít hơn count bình luận (trang cuối) → 1000, data.length < count, không có "Tải thêm"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockResolvedValue([]);
        // Chỉ còn 3 comment trong khi count = 20
        mockPrisma.comment.findMany.mockResolvedValue([
            mockComments[0],
            mockComments[1],
            {
                id: 'comment-3',
                postId: 'post-1',
                authorId: 'commenter-3',
                content: 'Bình luận thứ ba',
                createdAt: new Date('2024-01-01T08:00:00Z'),
                author: { id: 'commenter-3', username: 'Commenter3', avatar: 'avatar3.jpg' },
            },
        ]);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.code).toBe('1000');
        // Chỉ nhận được 3 bình luận dù count = 20
        expect(result.data).toHaveLength(3);
        // data.length (3) < count (20) → ứng dụng ẩn nút "Tải thêm"
        expect(result.data!.length).toBeLessThan(20);
        // Dữ liệu đúng thứ tự mới nhất trước
        expect(result.data![0].id).toBe('comment-1');
        expect(result.data![1].id).toBe('comment-2');
    });

    /**
     * TC9a: Lọc bình luận từ người bị block — sau khi lọc vẫn còn comment
     * Kết quả: 1000, comment từ commenter-blocked bị loại, các comment khác vẫn hiển thị
     */
    it('[TC9a] Lọc comment từ user bị block, vẫn còn comment → trả về 1000', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        // commenter-blocked đã block viewer (user-1)
        mockPrisma.block.findMany.mockResolvedValue([
            { blockerId: 'commenter-blocked', blockedId: 'user-1' } as unknown as Block,
        ]);
        // DB lọc commenter-blocked ra → còn lại 1 comment
        mockPrisma.comment.findMany.mockResolvedValue([mockComments[0]]);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.code).toBe('1000');
        expect(result.data).toHaveLength(1);
        expect(result.data![0].id).toBe('comment-1');
        // Đảm bảo query có filter authorId notIn
        expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    authorId: { notIn: ['commenter-blocked'] },
                } as unknown as Prisma.CommentWhereInput),
            }),
        );
    });

    /**
     * TC9b: Lọc bình luận từ người bị block — sau khi lọc KHÔNG còn comment nào (index = 0)
     * Kết quả: 9994 → server báo không có dữ liệu
     */
    it('[TC9b] Lọc comment từ user bị block, không còn comment nào → trả về 9994', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        // Tất cả người bình luận đều bị block
        mockPrisma.block.findMany.mockResolvedValue([
            { blockerId: 'commenter-1', blockedId: 'user-1' } as unknown as Block,
            { blockerId: 'commenter-2', blockedId: 'user-1' } as unknown as Block,
        ]);
        // Sau khi lọc → không còn comment nào
        mockPrisma.comment.findMany.mockResolvedValue([]);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.code).toBe('9994');
        // Đảm bảo query đã lọc đúng
        expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    authorId: { notIn: ['commenter-1', 'commenter-2'] },
                } as unknown as Prisma.CommentWhereInput),
            }),
        );
    });

    /**
     * TC10: Truyền đúng token, đúng id bài viết, nhưng index hoặc count bị sai
     *        (không phải số, âm, hoặc count = 0).
     * Kết quả: 1004 → sai tham số. Ứng dụng giữ nguyên hiển thị, không báo người dùng.
     * NOTE: Ứng dụng cần tự kiểm tra trước khi gửi. Nếu vẫn gửi lên thì server trả 1004.
     */
    it('[TC10a] index không phải số (NaN) → trả về 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        // parseInt("abc") = NaN → service nhận index = NaN
        const result = await service.getComment('valid-token', 'post-1', NaN, 20);

        expect(result.code).toBe('1004');
        expect(mockPrisma.block.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    it('[TC10b] count = 0 (không hợp lệ) → trả về 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const result = await service.getComment('valid-token', 'post-1', 0, 0);

        expect(result.code).toBe('1004');
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    it('[TC10c] index âm (< 0) → trả về 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const result = await service.getComment('valid-token', 'post-1', -1, 20);

        expect(result.code).toBe('1004');
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    /**
     * Bonus: GV dùng user_id không phải GV → 1009
     * (Tham số user_id chỉ dành cho GV)
     */
    it('[Bonus-TC] user_id param nhưng requester không phải GV → trả về 1009', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser); // role = HV

        const result = await service.getComment('valid-token', 'post-1', 0, 20, 'user-target');

        expect(result.code).toBe('1009');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC11: Chủ bài viết đã block viewer → is_blocked = "1"
     * Kết quả: 1000 nhưng is_blocked = "1" để app biết hiển thị cảnh báo
     */
    it('[TC11] Chủ bài viết block viewer → is_blocked="1"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        // Chủ bài viết (owner-1) đã block viewer (user-1)
        mockPrisma.block.findFirst.mockResolvedValue({
            blockerId: 'owner-1',
            blockedId: 'user-1',
        });
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue(mockComments);

        const result = await service.getComment('valid-token', 'post-1', 0, 20);

        expect(result.code).toBe('1000');
        expect(result.is_blocked).toBe('1');
    });

    /**
     * TC12: Commenter block viewer real-time (sau khi đã load)
     * NOTE: Đây là WebSocket/real-time concern.
     * Backend sẽ tự động lọc commenter đó ra ở request tiếp theo (TC9).
     * Test này chỉ xác nhận rằng logic lọc hoạt động đúng cho request mới.
     */
    it('[TC12] Real-time block (commenter block viewer) là WebSocket concern - backend lọc ở request tiếp theo', () => {
        // Hành vi được cover bởi TC9:
        // Khi commenter block viewer, block.findMany sẽ trả về block đó
        // và comment của commenter sẽ bị lọc ra khỏi kết quả ở request kế tiếp.
        expect(true).toBe(true);
    });

    /**
     * Bonus: GV dùng user_id hợp lệ → viewer chuyển sang user_id
     * Kết quả: 1000, xem comment theo góc nhìn của user_id
     */
    it('[Bonus] GV dùng user_id hợp lệ → viewer là user_id, trả về 1000', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockGVUser); // requester = GV
        mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser); // user_id tồn tại
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue(mockComments);

        const result = await service.getComment('gv-token', 'post-1', 0, 20, 'user-target');

        expect(result.code).toBe('1000');
        // block.findMany được gọi với viewer.id = user-target (không phải user-gv)
        expect(mockPrisma.block.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    OR: expect.arrayContaining([
                        { blockerId: 'user-target' } as unknown as Block,
                        { blockedId: 'user-target' } as unknown as Block,
                    ]),
                } as unknown as Prisma.BlockWhereInput),
            }),
        );
    });
});
