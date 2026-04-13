import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseCode } from '../enums/response-code.enum';
import { ICourseQuery } from './courses.interfaces';
import { ApiException } from '../common/exceptions/api.exception.ts';

@Injectable()
export class CoursesService implements ICourseQuery {
    constructor(private prisma: PrismaService) {}

    async setApproveEnrollment(token: string, user_id: string, is_accept: string) {
        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        if (requester.role !== 'GV') {
            throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
        }

        if (is_accept !== '0' && is_accept !== '1') {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid parameter value');
        }

        const request = await this.prisma.enrollmentRequest.findFirst({
            where: { studentId: user_id, teacherId: requester.id },
            include: { student: { select: { status: true } } },
        });
        if (!request) {
            throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
        }

        if (request.student.status === 'LOCKED') {
            throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
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

        return {};
    }

    async getListCoursesOfStudent(token: string, index: number, count: number, user_id: string) {
        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        const student = await this.prisma.user.findUnique({ where: { id: user_id } });
        if (!student) {
            throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
        }

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid parameter value');
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
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
        }

        const courses = enrollments.map((e) => ({
            id: e.teacher.id,
            name: e.teacher.username ?? '',
            avatar: e.teacher.avatar ?? '',
        }));

        return {
            total: total.toString(),
            courses,
        };
    }

    async getListStudents(token: string, index: number, count: number, user_id?: string) {
        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        let teacher = requester;
        if (user_id) {
            if (requester.role !== 'GV') {
                throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
            }
            const targetUser = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!targetUser) {
                throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
            }
            teacher = targetUser;
        }

        if (teacher.role !== 'GV') {
            throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
        }

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid parameter value');
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
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
        }

        const students = enrollments.map((e) => ({
            id: e.student.id,
            name: e.student.username ?? '',
            avatar: e.student.avatar ?? '',
        }));

        return {
            total: total.toString(),
            students,
        };
    }

    async getRequestedEnrollment(token: string, index: number, count: number, user_id?: string) {
        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        let teacher = requester;
        if (user_id) {
            if (requester.role !== 'GV') {
                throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
            }
            const targetUser = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!targetUser) {
                throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
            }
            teacher = targetUser;
        }

        if (teacher.role !== 'GV') {
            throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
        }

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid parameter value');
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
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
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
            data,
            total,
        };
    }

    async setRequestCourse(token: string, course_id: string, user_id: string) {
        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        const teacher = await this.prisma.user.findUnique({ where: { id: course_id } });
        if (!teacher || teacher.role !== 'GV') {
            throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
        }

        const student = await this.prisma.user.findUnique({ where: { id: user_id } });
        if (!student) {
            throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
        }

        await this.prisma.enrollmentRequest.create({
            data: {
                teacherId: course_id,
                studentId: user_id,
            },
        });

        return { id: teacher.id };
    }
}
