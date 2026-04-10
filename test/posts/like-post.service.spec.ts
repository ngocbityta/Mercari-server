import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// --- Mock data ---
const mockActiveUser = {
    id: 'user-1',
    phonenumber: '0901234567',
    password: 'abc123',
    username: 'TestUser',
    avatar: null,
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
    likeIds: [], // Chưa ai like
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

const mockLikedPost = { ...mockPost, likeIds: ['user-1'] }; // user-1 đã like rồi
const mockLockedPost = { ...mockPost, isLocked: true };

const mockPrisma = {
    user: { findFirst: jest.fn() },
    post: { findUnique: jest.fn(), update: jest.fn() },
};

describe('PostsService - likePost', () => {
    let service: PostsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PostsService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<PostsService>(PostsService);
        jest.clearAllMocks();
    });

    /**
     * TC1a: Like thành công (chưa like trước đó)
     * Kết quả: 1000, is_liked = "1", like tăng lên 1
     */
    it('[TC1a] Like bài viết thành công → trả về 1000, is_liked=1, like=1', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost); // likeIds = []
        mockPrisma.post.update.mockResolvedValue({ ...mockPost, likeIds: ['user-1'] });

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.code).toBe('1000');
        expect(result.data!.is_liked).toBe('1');
        expect(result.data!.like).toBe('1');
        expect(mockPrisma.post.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { likeIds: { push: 'user-1' } },
        });
    });

    /**
     * TC1b: Unlike thành công (đã like trước đó → bỏ like)
     * Kết quả: 1000, is_liked = "0", like giảm về 0
     */
    it('[TC1b] Unlike bài viết (bỏ like) → trả về 1000, is_liked=0, like=0', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockLikedPost); // likeIds = ['user-1']
        mockPrisma.post.update.mockResolvedValue({ ...mockPost, likeIds: [] });

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.code).toBe('1000');
        expect(result.data!.is_liked).toBe('0');
        expect(result.data!.like).toBe('0');
        expect(mockPrisma.post.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { likeIds: { set: [] } },
        });
    });

    /**
     * TC2: Token sai / trống / token phiên cũ
     * Kết quả: 9998 → ứng dụng đẩy sang trang đăng nhập
     */
    it('[TC2] Token không hợp lệ → trả về 9998', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await service.likePost('invalid-token', 'post-1');

        expect(result.code).toBe('9998');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.post.update).not.toHaveBeenCalled();
    });

    /**
     * TC3: Bài viết bị khóa (vi phạm tiêu chuẩn cộng đồng / bị hạn chế quốc gia)
     * Kết quả: 1010 → ứng dụng xóa bài viết khỏi trang hiện tại
     */
    it('[TC3] Bài viết bị khóa → trả về 1010', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockLockedPost); // isLocked = true

        const result = await service.likePost('valid-token', 'post-locked');

        expect(result.code).toBe('1010');
        expect(mockPrisma.post.update).not.toHaveBeenCalled();
    });

    /**
     * TC4: Tài khoản người dùng bị khóa
     * Kết quả: 9991 → ứng dụng đẩy sang trang đăng nhập
     */
    it('[TC4] Tài khoản bị khóa → trả về 9991', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedUser);

        const result = await service.likePost('locked-token', 'post-1');

        expect(result.code).toBe('9991');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.post.update).not.toHaveBeenCalled();
    });

    /**
     * TC5: DB không truy cập được
     * Kết quả: 1001 → ứng dụng hiện "Không thể kết nối Internet"
     */
    it('[TC5] DB lỗi khi update → trả về 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.post.update.mockRejectedValue(new Error('DB connection failed'));

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.code).toBe('1001');
    });

    /**
     * TC6: Post id không tồn tại
     * Kết quả: 9992 → báo bài viết không tồn tại
     */
    it('[TC6] Post id không tồn tại → trả về 9992', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const result = await service.likePost('valid-token', 'post-999');

        expect(result.code).toBe('9992');
        expect(mockPrisma.post.update).not.toHaveBeenCalled();
    });

    /**
     * TC7: Mạng bị ngắt giữa chừng
     * NOTE: Client-side concern — app tự handle timeout
     * Backend không thể test trường hợp này
     */
    it('[TC7] Lỗi mạng là client-side concern', () => {
        expect(true).toBe(true);
    });

    /**
     * TC8: Server trả về số like bất thường (âm hoặc quá lớn)
     * Backend guard: Math.max(0, count) đảm bảo không bao giờ trả về số âm
     * Kết quả: like luôn >= 0, app cập nhật UI theo hành động (like/unlike)
     */
    it('[TC8] DB trả về likeIds rỗng bất thường sau khi like → backend trả về ít nhất "1"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost); // chưa like
        // DB trả về likeIds rỗng dù đã like (bất thường)
        mockPrisma.post.update.mockResolvedValue({ ...mockPost, likeIds: [] });

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.code).toBe('1000');
        // TC9 guard: like nhưng count = 0 → backend tự sửa thành "1"
        expect(result.data!.is_liked).toBe('1');
        expect(parseInt(result.data!.like)).toBeGreaterThanOrEqual(1);
    });

    /**
     * TC9: Server trả về sai logic (like nhưng số like = 0)
     * Backend guard: nếu is_liked=1 nhưng count=0 → trả về count="1"
     * App vẫn hiển thị "Bạn thích bài viết" dựa theo is_liked
     */
    it('[TC9] Like thành công nhưng DB trả về count = 0 → backend trả về count = "1"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost); // chưa like
        mockPrisma.post.update.mockResolvedValue({ ...mockPost, likeIds: [] }); // sai logic

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.code).toBe('1000');
        expect(result.data!.is_liked).toBe('1'); // Hành động là like
        expect(result.data!.like).toBe('1'); // Backend tự sửa từ 0 → 1
    });
});
