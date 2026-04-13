import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

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

const mockLikedPost = { ...mockPost, likeIds: ['user-1'] };
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
     * TC1a: Like thành công
     */
    it('[TC1a] Like bài viết thành công', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.post.update.mockResolvedValue({ ...mockPost, likeIds: ['user-1'] });

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.is_liked).toBe('1');
        expect(result.like).toBe('1');
        expect(mockPrisma.post.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { likeIds: { push: 'user-1' } },
        });
    });

    /**
     * TC1b: Unlike thành công
     */
    it('[TC1b] Unlike bài viết (bỏ like)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockLikedPost);
        mockPrisma.post.update.mockResolvedValue({ ...mockPost, likeIds: [] });

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.is_liked).toBe('0');
        expect(result.like).toBe('0');
        expect(mockPrisma.post.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { likeIds: { set: [] } },
        });
    });

    /**
     * TC2: Token sai
     */
    it('[TC2] Token không hợp lệ → throws ApiException (TOKEN_INVALID)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.likePost('invalid-token', 'post-1');
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

        const call = () => service.likePost('valid-token', 'post-locked');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACTION_DONE_PREVIOUSLY);
        }
    });

    /**
     * TC4: Tài khoản người dùng bị khóa
     */
    it('[TC4] Tài khoản bị khóa → throws ApiException (ACCOUNT_LOCKED)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockLockedUser);

        const call = () => service.likePost('locked-token', 'post-1');
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
    it('[TC5] DB lỗi khi update → throws Error', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.post.update.mockRejectedValue(new Error('DB failure'));

        await expect(service.likePost('valid-token', 'post-1')).rejects.toThrow('DB failure');
    });

    /**
     * TC6: Post id không tồn tại
     */
    it('[TC6] Post id không tồn tại → throws ApiException (POST_NOT_FOUND)', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(null);

        const call = () => service.likePost('valid-token', 'post-999');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.POST_NOT_FOUND);
        }
    });

    /**
     * TC8: Server trả về số like bất thường
     */
    it('[TC8] DB trả về likeIds rỗng bất thường sau khi like → backend trả về ít nhất "1"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.post.update.mockResolvedValue({ ...mockPost, likeIds: [] });

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.is_liked).toBe('1');
        expect(parseInt(result.like)).toBeGreaterThanOrEqual(1);
    });

    /**
     * TC9: Server trả về sai logic
     */
    it('[TC9] Like thành công nhưng DB trả về count = 0 → backend trả về count = "1"', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockActiveUser);
        mockPrisma.post.findUnique.mockResolvedValue(mockPost);
        mockPrisma.post.update.mockResolvedValue({ ...mockPost, likeIds: [] });

        const result = await service.likePost('valid-token', 'post-1');

        expect(result.is_liked).toBe('1');
        expect(result.like).toBe('1');
    });
});
