import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum';

@Injectable()
export class SearchHistoryService {
    constructor(private prisma: PrismaService) {}

    async getSavedSearch(token: string, index?: string, count?: string, user_id?: string) {
        if (!token) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (requester.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        let targetUserId = requester.id;
        if (user_id) {
            // Admin only check
            if (requester.role !== 'GV') {
                return {
                    code: ResponseCode.NOT_ACCESS,
                    message: ResponseMessage[ResponseCode.NOT_ACCESS],
                };
            }
            targetUserId = user_id;
        }

        const idx = index ? parseInt(index) : 0;
        const cnt = count ? parseInt(count) : 20;

        try {
            const histories = await this.prisma.searchHistory.findMany({
                where: { userId: targetUserId },
                orderBy: { createdAt: 'desc' },
                skip: idx * cnt,
                take: cnt,
            });

            if (histories.length === 0 && idx === 0) {
                return {
                    code: ResponseCode.NO_DATA,
                    message: ResponseMessage[ResponseCode.NO_DATA],
                    data: [],
                };
            }

            const data = histories.map((h) => ({
                id: h.id,
                keyword: h.keyword,
                user_id: h.userId,
                duration_min: h.durationMin || '0',
                duration_max: h.durationMax || '0',
                created: h.createdAt.toISOString(),
            }));

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data,
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async delSavedSearch(token: string, search_id?: string, all: string = '0') {
        if (!token) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (requester.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        try {
            if (all === '1') {
                const count = await this.prisma.searchHistory.count({
                    where: { userId: requester.id },
                });
                if (count === 0) {
                    return {
                        code: ResponseCode.NO_DATA,
                        message: ResponseMessage[ResponseCode.NO_DATA],
                    };
                }

                await this.prisma.searchHistory.deleteMany({
                    where: { userId: requester.id },
                });

                return {
                    code: ResponseCode.OK,
                    message: ResponseMessage[ResponseCode.OK],
                };
            } else {
                if (!search_id) {
                    return {
                        code: ResponseCode.MISSING_PARAMETER,
                        message: ResponseMessage[ResponseCode.MISSING_PARAMETER],
                    };
                }

                const history = await this.prisma.searchHistory.findUnique({
                    where: { id: search_id },
                });

                if (!history) {
                    return {
                        code: ResponseCode.INVALID_PARAMETER_VALUE,
                        message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
                    };
                }

                if (history.userId !== requester.id) {
                    return {
                        code: ResponseCode.NOT_ACCESS,
                        message: ResponseMessage[ResponseCode.NOT_ACCESS],
                    };
                }

                await this.prisma.searchHistory.delete({
                    where: { id: search_id },
                });

                return {
                    code: ResponseCode.OK,
                    message: ResponseMessage[ResponseCode.OK],
                };
            }
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }
}
