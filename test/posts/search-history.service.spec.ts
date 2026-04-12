import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../../src/posts/posts.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseCode } from '../../src/enums/response-code.enum';
import { User, SearchHistory } from '@prisma/client';

describe('PostsService - Search History', () => {
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
                        searchHistory: {
                            create: jest.fn(),
                            findMany: jest.fn(),
                            findUnique: jest.fn(),
                            delete: jest.fn(),
                            deleteMany: jest.fn(),
                            count: jest.fn(),
                        },
                        block: {
                            findMany: jest.fn(),
                        },
                        post: {
                            findMany: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    const mockToken = 'valid_token';
    const mockUser = { id: 'user1', token: mockToken, status: 'ACTIVE', role: 'HV' };

    describe('getSavedSearch', () => {
        it('[TC1] should return search history for current user', async () => {
            jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
            jest.spyOn(prisma.searchHistory, 'findMany').mockResolvedValue([
                { id: '1', keyword: 'nike', userId: 'user1', createdAt: new Date() } as unknown as SearchHistory,
            ]);

            const result = await service.getSavedSearch(mockToken);
            expect(result.code).toBe(ResponseCode.OK);
            expect(result.data?.length).toBeGreaterThan(0);
        });

        it('[TC_ADMIN] GV should be able to check other user history', async () => {
            const mockAdmin = { id: 'admin1', token: 'admin_token', status: 'ACTIVE', role: 'GV' };
            jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockAdmin as unknown as User);
            const findManySpy = jest
                .spyOn(prisma.searchHistory, 'findMany')
                .mockResolvedValue([]);

            await service.getSavedSearch('admin_token', '0', '20', 'user2');
            expect(findManySpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user2' },
                }),
            );
        });
    });

    describe('delSavedSearch', () => {
        it('[TC_DEL_ALL] should delete all history when all="1" and history exists', async () => {
            jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
            jest.spyOn(prisma.searchHistory, 'count').mockResolvedValue(5);
            const deleteManySpy = jest
                .spyOn(prisma.searchHistory, 'deleteMany')
                .mockResolvedValue({ count: 5 });

            const result = await service.delSavedSearch(mockToken, undefined, '1');
            expect(result.code).toBe(ResponseCode.OK);
            expect(deleteManySpy).toHaveBeenCalledWith({ where: { userId: 'user1' } });
        });

        it('[TC_DEL_NO_DATA] should return NO_DATA when all="1" but no history exists', async () => {
            jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
            jest.spyOn(prisma.searchHistory, 'count').mockResolvedValue(0);

            const result = await service.delSavedSearch(mockToken, undefined, '1');
            expect(result.code).toBe(ResponseCode.NO_DATA);
        });

        it('[TC_DEL_SINGLE] should delete single entry and verify ownership', async () => {
            jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
            jest.spyOn(prisma.searchHistory, 'findUnique').mockResolvedValue({
                id: 's1',
                userId: 'user1',
            } as unknown as SearchHistory);
            const deleteSpy = jest
                .spyOn(prisma.searchHistory, 'delete')
                .mockResolvedValue({} as unknown as SearchHistory);

            const result = await service.delSavedSearch(mockToken, 's1', '0');
            expect(result.code).toBe(ResponseCode.OK);
            expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 's1' } });
        });

        it('[TC_DEL_NOT_FOUND] should return INVALID_PARAMETER_VALUE if search_id not exists', async () => {
            jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
            jest.spyOn(prisma.searchHistory, 'findUnique').mockResolvedValue(null);

            const result = await service.delSavedSearch(mockToken, 'non_existent', '0');
            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });

        it('[TC_DEL_FAIL] should fail if deleting other user history', async () => {
            jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as unknown as User);
            jest.spyOn(prisma.searchHistory, 'findUnique').mockResolvedValue({
                id: 's1',
                userId: 'other_user',
            } as unknown as SearchHistory);

            const result = await service.delSavedSearch(mockToken, 's1', '0');
            expect(result.code).toBe(ResponseCode.NOT_ACCESS);
        });
    });
});
