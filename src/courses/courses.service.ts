import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum';
import { ICourseQuery } from './courses.interfaces';

@Injectable()
export class CoursesService implements ICourseQuery {
    constructor(private prisma: PrismaService) {}

    async getRequestedEnrollment(token: string, index: number, count: number, user_id?: string) {
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

        let teacher = requester;
        if (user_id) {
            if (requester.role !== 'GV') {
                return {
                    code: ResponseCode.NOT_ACCESS,
                    message: ResponseMessage[ResponseCode.NOT_ACCESS],
                };
            }
            const targetUser = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!targetUser) {
                return {
                    code: ResponseCode.USER_NOT_VALIDATED,
                    message: ResponseMessage[ResponseCode.USER_NOT_VALIDATED],
                };
            }
            teacher = targetUser;
        }

        if (teacher.role !== 'GV') {
            return {
                code: ResponseCode.NOT_ACCESS,
                message: ResponseMessage[ResponseCode.NOT_ACCESS],
            };
        }

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
            };
        }

        try {
            const skip = index * count;
            const where = { teacherId: teacher.id };

            const [requests, total] = await Promise.all([
                this.prisma.enrollmentRequest.findMany({
                    where,
                    include: {
                        student: {
                            select: { id: true, username: true, avatar: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: count,
                }),
                this.prisma.enrollmentRequest.count({ where }),
            ]);

            if (requests.length === 0 && index === 0) {
                return {
                    code: ResponseCode.NO_DATA,
                    message: ResponseMessage[ResponseCode.NO_DATA],
                };
            }

            const data = requests.map((r) => ({
                request: {
                    id: r.student.id,
                    user_name: r.student.username ?? '',
                    avatar: r.student.avatar ?? '',
                    created: r.createdAt.toISOString(),
                },
            }));

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data,
                total,
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }
}
