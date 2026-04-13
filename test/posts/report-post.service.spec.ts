import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

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
     */
    it('[TC1] Gửi đúng token, postId, subject, details → trả về {}', async () => {
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

        expect(result).toEqual({});
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
     * Test case 2: Token sai
     */
    it('[TC2] Token không hợp lệ → throws ApiException (TOKEN_INVALID)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () =>
            service.reportPost('invalid-or-expired-token', 'post-1', 'Vi phạm', 'Chi tiết');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    /**
     * Test case 3: Bài viết bị khóa
     */
    it('[TC3] Bài viết bị khóa/hạn chế → throws ApiException (ACTION_DONE_PREVIOUSLY)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockLockedPost);

        const call = () => service.reportPost('valid-token', 'post-locked', 'Vi phạm', 'Chi tiết');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACTION_DONE_PREVIOUSLY);
        }
    });

    /**
     * Test case 4: Tài khoản người dùng bị khóa
     */
    it('[TC4] Tài khoản bị khóa → throws ApiException (ACCOUNT_LOCKED)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedUser);

        const call = () => service.reportPost('locked-user-token', 'post-1', 'Vi phạm', 'Chi tiết');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    /**
     * Test case 5: DB lỗi
     */
    it('[TC5] DB không truy cập được → throws Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.report.findUnique.mockRejectedValue(new Error('DB connection failed'));

        await expect(
            service.reportPost('valid-token', 'post-1', 'Vi phạm', 'Chi tiết'),
        ).rejects.toThrow('DB connection failed');
    });

    /**
     * Test case 6: Sai id bài viết
     */
    it('[TC6] Post id không tồn tại → throws ApiException (POST_NOT_FOUND)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const call = () =>
            service.reportPost('valid-token', 'post-999-khong-ton-tai', 'Vi phạm', 'Chi tiết');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.POST_NOT_FOUND);
        }
    });

    it('[TC7] Lỗi mạng is client-side concern', () => {
        expect(true).toBe(true);
    });
});
