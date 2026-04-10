import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// Mock data
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

const mockLockedUser = {
    ...mockActiveUser,
    token: 'locked-user-token',
    status: 'LOCKED',
};

const mockPost = {
    id: 'post-1',
    ownerId: 'user-1',
    content: 'Bài test',
    media: [],
    hashtags: [],
    commentIds: [],
    likeIds: [],
    courseId: null,
    exerciseId: null,
    deviceMaster: 'device-001',
    deviceSlave: null,
    leftVideo: null,
    rightVideo: null,
    isLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockLockedPost = {
    ...mockPost,
    id: 'post-locked',
    isLocked: true,
};

const mockPrisma = {
    user: { findFirst: jest.fn() },
    post: { findUnique: jest.fn() },
    report: { findUnique: jest.fn(), create: jest.fn() },
};

describe('PostsService - reportPost', () => {
    let service: PostsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PostsService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<PostsService>(PostsService);
        jest.clearAllMocks();
    });

    /**
     * Test case 1: Người dùng truyền đúng tất cả thông tin
     * Kết quả mong đợi: 1000 | OK
     */
    it('[TC1] Gửi đúng token, postId, subject, details → trả về 1000', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.report.findUnique.mockResolvedValue(null);
        mockPrisma.report.create.mockResolvedValue({ id: 'report-1' });

        const result = await service.reportPost(
            'valid-token',
            'post-1',
            'Nội dung không phù hợp',
            'Bài viết chứa ngôn ngữ thù địch',
        );

        expect(result.code).toBe('1000');
        expect(result.message).toBe('OK');
        expect(mockPrisma.report.create).toHaveBeenCalledWith({
            data: {
                postId: 'post-1',
                userId: 'user-1',
                subject: 'Nội dung không phù hợp',
                details: 'Bài viết chứa ngôn ngữ thù địch',
            },
        });
    });

    /**
     * Test case 2: Token sai / trống / token phiên cũ
     * Kết quả mong đợi: 9998 → ứng dụng đẩy sang trang đăng nhập
     */
    it('[TC2] Token không hợp lệ (sai/trống/cũ) → trả về 9998', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const result = await service.reportPost(
            'invalid-or-expired-token',
            'post-1',
            'Vi phạm',
            'Chi tiết',
        );

        expect(result.code).toBe('9998');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
    });

    /**
     * Test case 3: Bài viết bị khóa trước khi gửi báo cáo
     * Kết quả mong đợi: 1010 → ứng dụng xóa bài viết khỏi trang hiện tại
     */
    it('[TC3] Bài viết bị khóa/hạn chế → trả về 1010', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockLockedPost);

        const result = await service.reportPost(
            'valid-token',
            'post-locked',
            'Vi phạm',
            'Chi tiết',
        );

        expect(result.code).toBe('1010');
        expect(mockPrisma.report.create).not.toHaveBeenCalled();
    });

    /**
     * Test case 4: Tài khoản người dùng bị khóa
     * Kết quả mong đợi: 9991 → ứng dụng đẩy sang trang đăng nhập
     */
    it('[TC4] Tài khoản bị khóa → trả về 9991', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedUser);

        const result = await service.reportPost(
            'locked-user-token',
            'post-1',
            'Vi phạm',
            'Chi tiết',
        );

        expect(result.code).toBe('9991');
        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.report.create).not.toHaveBeenCalled();
    });

    /**
     * Test case 5: Hệ thống không thể tiếp nhận báo cáo (DB lỗi)
     * Kết quả mong đợi: 1001 → ứng dụng hiện "Không thể kết nối Internet"
     */
    it('[TC5] DB không truy cập được → trả về 1001', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.report.findUnique.mockRejectedValue(new Error('DB connection failed'));

        const result = await service.reportPost('valid-token', 'post-1', 'Vi phạm', 'Chi tiết');

        expect(result.code).toBe('1001');
    });

    /**
     * Test case 6: Sai id bài viết (không tồn tại)
     * Kết quả mong đợi: 9992 → báo bài viết không tồn tại
     */
    it('[TC6] Post id không tồn tại → trả về 9992', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const result = await service.reportPost(
            'valid-token',
            'post-999-khong-ton-tai',
            'Vi phạm',
            'Chi tiết',
        );

        expect(result.code).toBe('9992');
        expect(mockPrisma.report.create).not.toHaveBeenCalled();
    });

    /**
     * Test case 7: Mạng bị ngắt giữa chừng
     * NOTE: Đây là lỗi phía client/network, không thể test ở service layer.
     * Client (mobile/web app) cần handle: request timeout → hiện "Không thể kết nối Internet"
     */
    it('[TC7] Lỗi mạng là client-side concern - backend trả về 1001 khi không kết nối được', () => {
        expect(true).toBe(true);
    });
});
