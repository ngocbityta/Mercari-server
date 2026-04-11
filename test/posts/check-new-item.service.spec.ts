import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseCode } from '../../src/enums/response-code.enum';

describe('PostsService - checkNewItem', () => {
    let service: PostsService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PostsService,
                {
                    provide: PrismaService,
                    useValue: {
                        post: {
                            findUnique: jest.fn(),
                            count: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    // Test Case 1: Truyền đúng mã last_id, category_id
    it('[TC1] should return new items count when parameters are valid', async () => {
        const mockLastPost = { id: 'last_id', createdAt: new Date(Date.now() - 10000) };
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(mockLastPost as any);
        jest.spyOn(prisma.post, 'count').mockResolvedValue(5);

        const result = await service.checkNewItem('last_id', '0');
        expect(result.code).toBe(ResponseCode.OK);
        expect(result.data!.new_items).toBe('5');
    });

    // Test Case 2: Không truyền last_id (NN=O)
    it('[TC2] should return 0 new items when last_id is not provided', async () => {
        const result = await service.checkNewItem(undefined, '0');
        expect(result.code).toBe(ResponseCode.OK);
        expect(result.data!.new_items).toBe('0');
    });

    // Test Case 3: Giá trị trả về không hợp lệ (Mock logic trả về số lượng bài mới)
    it('[TC3] should return "0" if last_id is not found in database', async () => {
        jest.spyOn(prisma.post, 'findUnique').mockResolvedValue(null);

        const result = await service.checkNewItem('non_existent_id', '0');
        expect(result.code).toBe(ResponseCode.OK);
        expect(result.data!.new_items).toBe('0');
    });

    // Test Case 6: Server bị lỗi không lấy được giá trị
    it('[TC6] should return CAN_NOT_CONNECT when database query fails', async () => {
        jest.spyOn(prisma.post, 'findUnique').mockRejectedValue(new Error('DB Error'));

        const result = await service.checkNewItem('last_id', '0');
        expect(result.code).toBe(ResponseCode.CAN_NOT_CONNECT);
    });
});
