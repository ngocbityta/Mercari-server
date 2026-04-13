import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from '../../src/courses/courses.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';

const mockPrisma = {
    user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
    },
    enrollmentRequest: {
        create: jest.fn(),
    },
};

describe('CoursesService - setRequestCourse', () => {
    let service: CoursesService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CoursesService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<CoursesService>(CoursesService);
        jest.clearAllMocks();
    });

    // TC1: Gửi yêu cầu tham gia khoá học thành công
    it('TC1: success - returns teacher id', async () => {
        const teacher = { id: 'teacher-1', role: 'GV', status: 'ACTIVE' };
        const student = { id: 'student-1', role: 'HV', status: 'ACTIVE' };
        const requester = { id: 'student-1', token: 'valid-token', status: 'ACTIVE', role: 'HV' };

        mockPrisma.user.findFirst.mockResolvedValue(requester);
        mockPrisma.user.findUnique
            .mockResolvedValueOnce(teacher) // course_id lookup
            .mockResolvedValueOnce(student); // user_id lookup
        mockPrisma.enrollmentRequest.create.mockResolvedValue({
            id: 'req-1',
            teacherId: teacher.id,
            studentId: student.id,
            createdAt: new Date(),
        });

        const result = await service.setRequestCourse('valid-token', teacher.id, student.id);

        expect(result.id).toBe(teacher.id);
        expect(mockPrisma.enrollmentRequest.create).toHaveBeenCalledWith({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: expect.objectContaining({
                teacherId: teacher.id,
                studentId: student.id,
            } as unknown as Prisma.EnrollmentRequestCreateInput),
        });
    });

    // TC2: Token sai
    it('TC2: invalid token - throws ApiException TOKEN_INVALID', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);

        const call = () => service.setRequestCourse('bad-token', 'teacher-1', 'student-1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.TOKEN_INVALID);
        }
    });

    // TC3: course_id không tồn tại hoặc không phải GV
    it('TC3: course_id does not exist - throws ApiException USER_NOT_VALIDATED', async () => {
        const requester = { id: 'student-1', token: 'valid-token', status: 'ACTIVE', role: 'HV' };

        mockPrisma.user.findFirst.mockResolvedValue(requester);
        mockPrisma.user.findUnique.mockResolvedValueOnce(null); // teacher not found

        const call = () => service.setRequestCourse('valid-token', 'nonexistent-id', 'student-1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.USER_NOT_VALIDATED);
        }
    });

    // TC3b: course_id tồn tại nhưng không phải GV
    it('TC3b: course_id exists but not GV - throws ApiException USER_NOT_VALIDATED', async () => {
        const nonTeacher = { id: 'user-1', role: 'HV', status: 'ACTIVE' };
        const requester = { id: 'student-1', token: 'valid-token', status: 'ACTIVE', role: 'HV' };

        mockPrisma.user.findFirst.mockResolvedValue(requester);
        mockPrisma.user.findUnique.mockResolvedValueOnce(nonTeacher);

        const call = () => service.setRequestCourse('valid-token', nonTeacher.id, 'student-1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.USER_NOT_VALIDATED);
        }
    });

    // TC4: Tài khoản bị khóa
    it('TC4: account locked - throws ApiException ACCOUNT_LOCKED', async () => {
        const requester = { id: 'student-1', token: 'valid-token', status: 'LOCKED', role: 'HV' };

        mockPrisma.user.findFirst.mockResolvedValue(requester);

        const call = () => service.setRequestCourse('valid-token', 'teacher-1', 'student-1');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.ACCOUNT_LOCKED);
        }
    });

    // TC6: Lỗi DB
    it('TC6: DB error on create - throws Error', async () => {
        const teacher = { id: 'teacher-1', role: 'GV', status: 'ACTIVE' };
        const student = { id: 'student-1', role: 'HV', status: 'ACTIVE' };
        const requester = { id: 'student-1', token: 'valid-token', status: 'ACTIVE', role: 'HV' };

        mockPrisma.user.findFirst.mockResolvedValue(requester);
        mockPrisma.user.findUnique.mockResolvedValueOnce(teacher).mockResolvedValueOnce(student);
        mockPrisma.enrollmentRequest.create.mockRejectedValue(new Error('DB failure'));

        await expect(
            service.setRequestCourse('valid-token', teacher.id, student.id),
        ).rejects.toThrow('DB failure');
    });

    // TC8: student (user_id) không tồn tại trong DB
    it('TC8: student (user_id) not found - throws ApiException USER_NOT_VALIDATED', async () => {
        const teacher = { id: 'teacher-1', role: 'GV', status: 'ACTIVE' };
        const requester = { id: 'requester-1', token: 'valid-token', status: 'ACTIVE', role: 'HV' };

        mockPrisma.user.findFirst.mockResolvedValue(requester);
        mockPrisma.user.findUnique
            .mockResolvedValueOnce(teacher) // course_id lookup
            .mockResolvedValueOnce(null); // user_id lookup

        const call = () =>
            service.setRequestCourse('valid-token', teacher.id, 'nonexistent-student');
        await expect(call()).rejects.toThrow(ApiException);
        try {
            await call();
        } catch (e) {
            expect((e as ApiException).code).toBe(ResponseCode.USER_NOT_VALIDATED);
        }
    });
});
