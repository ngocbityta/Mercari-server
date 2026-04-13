import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseCode } from '../enums/response-code.enum';
import { ApiException } from '../common/exceptions/api.exception.ts';

@Injectable()
export class SearchHistoryService {
    constructor(private prisma: PrismaService) {}

    async getSavedSearch(token: string, index?: string, count?: string, user_id?: string) {
        if (!token) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        let targetUserId = requester.id;
        if (user_id) {
            // Admin only check
            if (requester.role !== 'GV') {
                throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
            }
            targetUserId = user_id;
        }

        const idx = index ? parseInt(index) : 0;
        const cnt = count ? parseInt(count) : 20;

        const histories = await this.prisma.searchHistory.findMany({
            where: { userId: targetUserId },
            orderBy: { createdAt: 'desc' },
            skip: idx * cnt,
            take: cnt,
        });

        if (histories.length === 0 && idx === 0) {
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
        }

        return histories.map((h) => ({
            id: h.id,
            keyword: h.keyword,
            user_id: h.userId,
            duration_min: h.durationMin || '0',
            duration_max: h.durationMax || '0',
            created: h.createdAt.toISOString(),
        }));
    }

    async delSavedSearch(token: string, search_id?: string, all: string = '0') {
        if (!token) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        if (all === '1') {
            const count = await this.prisma.searchHistory.count({
                where: { userId: requester.id },
            });
            if (count === 0) {
                throw new ApiException(ResponseCode.NO_DATA, 'No data');
            }

            await this.prisma.searchHistory.deleteMany({
                where: { userId: requester.id },
            });

            return {};
        } else {
            if (!search_id) {
                throw new ApiException(ResponseCode.MISSING_PARAMETER, 'Parameter is not enough');
            }

            const history = await this.prisma.searchHistory.findUnique({
                where: { id: search_id },
            });

            if (!history) {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Parameter value is invalid',
                );
            }

            if (history.userId !== requester.id) {
                throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
            }

            await this.prisma.searchHistory.delete({
                where: { id: search_id },
            });

            return {};
        }
    }
}
