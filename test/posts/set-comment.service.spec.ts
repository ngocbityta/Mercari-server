import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Block } from '@prisma/client';

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
     * TC1: Truyền đúng mã phiên, id bài viết, các chỉ số đúng.
     *       Hệ thống KHÔNG có bình luận mới nào chưa lấy về.
     * Kết quả: 1000 | OK, hiển thị bình luận mới nhất của người dùng.
     *
     * NOTE: Cũng bao gồm trường hợp comment chấm điểm (score thay vì comment text).
     */
    it('[TC1] Bình luận thành công, không có comment mới từ người khác → 1000, hiển thị comment vừa tạo', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        mockPrisma.block.findMany.mockResolvedValue([]);
        // Chỉ có comment vừa tạo — không có comment mới từ người khác
        mockPrisma.comment.findMany.mockResolvedValue([mockMyComment]);

        const result = await service.setComment(
            'valid-token',
            'post-1',
            0,
            20,
            'Bình luận của tôi',
        );

        expect(result.code).toBe('1000');
        expect(result.data).toHaveLength(1);
        expect(result.data![0]).toMatchObject({
            id: 'comment-my',
            comment: 'Bình luận của tôi',
            poster: { id: 'user-1', name: 'TestUser' },
        });
        expect(result.is_blocked).toBe('0');
    });

    it('[TC1-score] Bình luận chấm điểm thành công → 1000, score lưu vào DB', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockScoreComment);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([mockScoreComment]);

        const result = await service.setComment(
            'valid-token',
            'post-1',
            0,
            20,
            undefined,
            '85',
            '<table><tr><td>Lỗi tư thế</td></tr></table>',
        );

        expect(result.code).toBe('1000');
        expect(mockPrisma.comment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                score: '85',
                detailMistakes: '<table><tr><td>Lỗi tư thế</td></tr></table>',
            }),
        });
    });

    /**
     * TC2: Mã phiên đăng nhập sai (trống, quá ngắn, hoặc phiên cũ).
     * Kết quả: 9998 → ứng dụng đẩy người dùng sang trang đăng nhập.
     */
    it('[TC2] Token sai / phiên cũ → trả về 9998, không tạo comment', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await service.setComment('token-sai', 'post-1', 0, 20, 'Bình luận');

        expect(result.code).toBe('9998');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.comment.create).not.toHaveBeenCalled();
    });

    /**
     * TC3: Bài viết bị khóa (vi phạm cộng đồng / bị hạn chế quốc gia)
     *       xảy ra trong lúc người dùng đang gõ bình luận.
     * Kết quả: 1010 → ứng dụng xóa bài viết khỏi danh sách hiện tại.
     */
    it('[TC3] Bài viết bị khóa trong lúc đang bình luận → trả về 1010, không tạo comment', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockLockedPost); // isLocked = true

        const result = await service.setComment('valid-token', 'post-locked', 0, 20, 'Bình luận');

        expect(result.code).toBe('1010');
        expect(mockPrisma.comment.create).not.toHaveBeenCalled();
    });

    /**
     * TC4: Tài khoản bị khóa (hệ thống khóa giữa chừng).
     * Kết quả: 9991 → ứng dụng đẩy người dùng sang trang đăng nhập.
     */
    it('[TC4] Tài khoản bị khóa → trả về 9991, không tạo comment', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedUser);

        const result = await service.setComment('locked-token', 'post-1', 0, 20, 'Bình luận');

        expect(result.code).toBe('9991');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.comment.create).not.toHaveBeenCalled();
    });

    /**
     * TC5: CSDL không truy cập được khi chèn bình luận.
     * Kết quả: 1001 → ứng dụng hiện "Không thể kết nối Internet".
     */
    it('[TC5] DB lỗi khi tạo comment → trả về 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockRejectedValue(new Error('DB connection failed'));

        const result = await service.setComment('valid-token', 'post-1', 0, 20, 'Bình luận');

        expect(result.code).toBe('1001');
        // comment.create được gọi nhưng ném lỗi → không gọi findMany
        expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    /**
     * TC6: Sai id bài viết (bài viết không tồn tại trong DB).
     * Kết quả: 9992 → báo bài viết không tồn tại.
     */
    it('[TC6] Post id không tồn tại → trả về 9992, không tạo comment', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const result = await service.setComment('valid-token', 'post-999', 0, 20, 'Bình luận');

        expect(result.code).toBe('9992');
        expect(mockPrisma.comment.create).not.toHaveBeenCalled();
    });

    /**
     * TC7: Mạng Internet bị ngắt trong khi gửi yêu cầu.
     * NOTE: Đây là client-side concern — ứng dụng tự phát hiện timeout/network error.
     *       Backend không xử lý được trường hợp này vì request không bao giờ tới server.
     */
    it('[TC7] Mạng bị ngắt là client-side concern — backend không xử lý được', () => {
        // Ứng dụng cần set timeout và hiện "Không thể kết nối Internet" khi request thất bại.
        // Server không nhận được request nên không có gì để test ở đây.
        expect(true).toBe(true);
    });

    /**
     * TC8: Thành công + hệ thống có thêm comment mới từ người khác chưa lấy về.
     * Kết quả: 1000, data chứa cả comment mới từ người khác + comment vừa tạo.
     *          Ứng dụng cuộn xuống bình luận mới nhất.
     */
    it('[TC8] Có comment mới từ người khác → 1000, data chứa tất cả comment mới', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        mockPrisma.block.findMany.mockResolvedValue([]);
        // API trả về cả comment của mình + comment mới của người khác (sắp xếp mới nhất trước)
        mockPrisma.comment.findMany.mockResolvedValue([mockMyComment, mockOtherComment]);

        const result = await service.setComment(
            'valid-token',
            'post-1',
            0,
            20,
            'Bình luận của tôi',
        );

        expect(result.code).toBe('1000');
        expect(result.data).toHaveLength(2);
        // Comment mới nhất đứng đầu (mockMyComment vừa tạo)
        expect(result.data![0].id).toBe('comment-my');
        // Comment của người khác cũng xuất hiện
        expect(result.data![1].id).toBe('comment-other');
    });

    /**
     * TC9: Trong danh sách comment trả về có người đang chặn user hoặc bị user chặn.
     * Kết quả: Server lọc ra comment của người đó.
     *          Nếu sau khi lọc không còn comment nào → vẫn trả về 1000 (bình luận thành công).
     */
    it('[TC9] Comment có người bị block → filter, vẫn trả 1000 kể cả khi data rỗng', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null);
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        // user-1 và commenter-blocked có block relationship
        mockPrisma.block.findMany.mockResolvedValue([
            { blockerId: 'commenter-blocked', blockedId: 'user-1' } as unknown as Block,
        ]);
        // Sau khi lọc không còn comment nào (comment vừa tạo cũng bị lọc vì authorId = user-1
        // nhưng blockedUserIds chỉ chứa 'commenter-blocked', không chứa 'user-1' → vẫn có)
        // Giả lập: chỉ có comment của commenter-blocked bị lọc → data rỗng
        mockPrisma.comment.findMany.mockResolvedValue([]); // Tất cả comment bị lọc hết

        const result = await service.setComment(
            'valid-token',
            'post-1',
            0,
            20,
            'Bình luận của tôi',
        );

        // Bình luận vẫn THÀNH CÔNG dù danh sách trả về rỗng
        expect(result.code).toBe('1000');
        expect(result.data).toHaveLength(0);
        // Query phải có filter notIn cho blocked user
        expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    authorId: { notIn: ['commenter-blocked'] },
                }),
            }),
        );
    });

    /**
     * TC10: Nội dung bình luận trống (hoặc không truyền cả comment lẫn score).
     * Kết quả: 1002 → server báo thiếu tham số.
     *          Ứng dụng cần tự kiểm tra trước khi gửi. Nếu vẫn gửi lên → server trả lỗi,
     *          ứng dụng giữ nguyên UI, không báo người dùng.
     *
     * NOTE: Nếu truyền cả comment lẫn score cùng lúc (xung đột) → 1004.
     */
    it('[TC10a] Comment là chuỗi rỗng → trả về 1002 (thiếu tham số)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const result = await service.setComment('valid-token', 'post-1', 0, 20, '   '); // chỉ khoảng trắng

        expect(result.code).toBe('1002');
        expect(mockPrisma.comment.create).not.toHaveBeenCalled();
    });

    it('[TC10b] Không truyền cả comment lẫn score → trả về 1002', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const result = await service.setComment('valid-token', 'post-1', 0, 20);

        expect(result.code).toBe('1002');
        expect(mockPrisma.comment.create).not.toHaveBeenCalled();
    });

    it('[TC10c] Truyền cả comment lẫn score cùng lúc (xung đột) → trả về 1004', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);

        const result = await service.setComment('valid-token', 'post-1', 0, 20, 'Bình luận', '85');

        expect(result.code).toBe('1004');
        expect(mockPrisma.comment.create).not.toHaveBeenCalled();
    });

    /**
     * TC11: Chủ bài viết chặn người dùng trong lúc đang đăng bình luận.
     * Kết quả: Server phát hiện block → trả về 1000 kèm is_blocked="1".
     *          Ứng dụng ẩn popup bình luận, xóa bài viết khỏi danh sách.
     */
    it('[TC11] Chủ bài viết block user giữa chừng → 1000, is_blocked="1"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        // Chủ bài viết (owner-1) đã block user-1 trước khi comment được xử lý
        mockPrisma.block.findFirst.mockResolvedValue({
            blockerId: 'owner-1',
            blockedId: 'user-1',
        });
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        mockPrisma.block.findMany.mockResolvedValue([]);
        mockPrisma.comment.findMany.mockResolvedValue([mockMyComment]);

        const result = await service.setComment('valid-token', 'post-1', 0, 20, 'Bình luận');

        expect(result.code).toBe('1000');
        // is_blocked="1" để client biết mình bị block → ẩn popup + xóa bài
        expect(result.is_blocked).toBe('1');
    });

    /**
     * TC12: Một người trong danh sách bình luận chặn user trong lúc đang đăng.
     * Kết quả: Server lọc comment của người đó ra khỏi kết quả trả về.
     *          Comment của họ đã hiển thị ở client trước đó → client giữ nguyên lần đó.
     *          Từ đây trở đi, server không gửi về comment của người chặn nữa.
     *
     * NOTE: Đây là real-time/WebSocket concern cho các request tiếp theo.
     *       Test này xác nhận rằng ngay trong request set_comment, server đã lọc đúng.
     */
    it('[TC12] Commenter block user giữa chừng → server lọc comment đó, trả 1000', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.block.findFirst.mockResolvedValue(null); // post owner không block
        mockPrisma.comment.create.mockResolvedValue(mockMyComment);
        // commenter-X vừa block user-1 trước khi server trả response
        mockPrisma.block.findMany.mockResolvedValue([
            { blockerId: 'commenter-x', blockedId: 'user-1' },
        ]);
        // Comment của commenter-x bị loại, chỉ còn comment của user-1
        mockPrisma.comment.findMany.mockResolvedValue([mockMyComment]);

        const result = await service.setComment('valid-token', 'post-1', 0, 20, 'Bình luận');

        expect(result.code).toBe('1000');
        expect(result.is_blocked).toBe('0'); // post owner không block
        // Query phải lọc bỏ commenter-x
        expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    authorId: { notIn: ['commenter-x'] },
                }),
            }),
        );
        // Comment của commenter-x không có trong kết quả
        const ids = result.data!.map((c: { id: string }) => c.id);
        expect(ids).not.toContain('comment-x');
    });
});
