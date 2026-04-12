import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum';
import { ICourseQuery } from './courses.interfaces';

@Injectable()
export class CoursesService implements ICourseQuery {
    constructor(private prisma: PrismaService) {}

    async setApproveEnrollment(token: string, user_id: string, is_accept: string) {
        try {
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

            if (requester.role !== 'GV') {
                return {
                    code: ResponseCode.NOT_ACCESS,
                    message: ResponseMessage[ResponseCode.NOT_ACCESS],
                };
            }

            if (is_accept !== '0' && is_accept !== '1') {
                return {
                    code: ResponseCode.INVALID_PARAMETER_VALUE,
                    message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
                };
            }

            const request = await this.prisma.enrollmentRequest.findFirst({
                where: { studentId: user_id, teacherId: requester.id },
                include: { student: { select: { status: true } } },
            });
            if (!request) {
                return {
                    code: ResponseCode.USER_NOT_VALIDATED,
                    message: ResponseMessage[ResponseCode.USER_NOT_VALIDATED],
                };
            }

            if (request.student.status === 'LOCKED') {
                return {
                    code: ResponseCode.USER_NOT_VALIDATED,
                    message: ResponseMessage[ResponseCode.USER_NOT_VALIDATED],
                };
            }

            if (is_accept === '1') {
                await this.prisma.$transaction(async (tx) => {
                    await tx.enrollment.create({
                        data: { studentId: user_id, teacherId: requester.id },
                    });
                    await tx.enrollmentRequest.delete({ where: { id: request.id } });
                });
            } else {
                await this.prisma.enrollmentRequest.delete({ where: { id: request.id } });
            }

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async getListCoursesOfStudent(token: string, index: number, count: number, user_id: string) {
        try {
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

            const student = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!student) {
                return {
                    code: ResponseCode.USER_NOT_VALIDATED,
                    message: ResponseMessage[ResponseCode.USER_NOT_VALIDATED],
                };
            }

            if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
                return {
                    code: ResponseCode.INVALID_PARAMETER_VALUE,
                    message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
                };
            }

            const skip = index * count;
            const where = { studentId: student.id };

            const [enrollments, total] = await Promise.all([
                this.prisma.enrollment.findMany({
                    where,
                    include: {
                        teacher: {
                            select: { id: true, username: true, avatar: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: count,
                }),
                this.prisma.enrollment.count({ where }),
            ]);

            if (enrollments.length === 0 && index === 0) {
                return {
                    code: ResponseCode.NO_DATA,
                    message: ResponseMessage[ResponseCode.NO_DATA],
                };
            }

            const courses = enrollments.map((e) => ({
                id: e.teacher.id,
                name: e.teacher.username ?? '',
                avatar: e.teacher.avatar ?? '',
            }));

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: {
                    total: total.toString(),
                    courses,
                },
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async getListStudents(token: string, index: number, count: number, user_id?: string) {
        try {
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

            const skip = index * count;
            const where = { teacherId: teacher.id };

            const [enrollments, total] = await Promise.all([
                this.prisma.enrollment.findMany({
                    where,
                    include: {
                        student: {
                            select: { id: true, username: true, avatar: true },
                        },
                    },
                    orderBy: { student: { username: 'asc' } },
                    skip,
                    take: count,
                }),
                this.prisma.enrollment.count({ where }),
            ]);

            if (enrollments.length === 0 && index === 0) {
                return {
                    code: ResponseCode.NO_DATA,
                    message: ResponseMessage[ResponseCode.NO_DATA],
                };
            }

            const students = enrollments.map((e) => ({
                id: e.student.id,
                name: e.student.username ?? '',
                avatar: e.student.avatar ?? '',
            }));

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: {
                    total: total.toString(),
                    students,
                },
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async getRequestedEnrollment(token: string, index: number, count: number, user_id?: string) {
        try {
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

    async setRequestCourse(token: string, course_id: string, user_id: string) {
        try {
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

            const teacher = await this.prisma.user.findUnique({ where: { id: course_id } });
            if (!teacher || teacher.role !== 'GV') {
                return {
                    code: ResponseCode.USER_NOT_VALIDATED,
                    message: ResponseMessage[ResponseCode.USER_NOT_VALIDATED],
                };
            }

            const student = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!student) {
                return {
                    code: ResponseCode.USER_NOT_VALIDATED,
                    message: ResponseMessage[ResponseCode.USER_NOT_VALIDATED],
                };
            }

            await this.prisma.enrollmentRequest.create({
                data: {
                    teacherId: course_id,
                    studentId: user_id,
                },
            });

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: { id: teacher.id },
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }
}
