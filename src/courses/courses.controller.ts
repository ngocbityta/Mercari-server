import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CoursesService } from './courses.service.ts';
import {
    GetListCoursesOfStudentDto,
    GetListStudentsDto,
    GetRequestedEnrollmentDto,
    SetApproveEnrollmentDto,
    SetRequestCourseDto,
} from './courses.dto.ts';
import { ApiResponse } from '../common/dto/api-response.dto.ts';

@Controller()
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    @Post('get_list_students')
    @HttpCode(HttpStatus.OK)
    async getListStudents(@Body() body: GetListStudentsDto) {
        const result = await this.coursesService.getListStudents(
            body.token,
            parseInt(body.index),
            parseInt(body.count),
            body.user_id,
        );
        return ApiResponse.success(result);
    }

    @Post('get_requested_enrollment')
    @HttpCode(HttpStatus.OK)
    async getRequestedEnrollment(@Body() body: GetRequestedEnrollmentDto) {
        const result = await this.coursesService.getRequestedEnrollment(
            body.token,
            parseInt(body.index),
            parseInt(body.count),
            body.user_id,
        );
        return ApiResponse.success(result);
    }

    @Post('get_list_courses_of_student')
    @HttpCode(HttpStatus.OK)
    async getListCoursesOfStudent(@Body() body: GetListCoursesOfStudentDto) {
        const result = await this.coursesService.getListCoursesOfStudent(
            body.token,
            parseInt(body.index),
            parseInt(body.count),
            body.user_id,
        );
        return ApiResponse.success(result);
    }

    @Post('set_approve_enrollment')
    @HttpCode(HttpStatus.OK)
    async setApproveEnrollment(@Body() body: SetApproveEnrollmentDto) {
        const result = await this.coursesService.setApproveEnrollment(
            body.token,
            body.user_id,
            body.is_accept,
        );
        return ApiResponse.success(result);
    }

    @Post('set_request_course')
    @HttpCode(HttpStatus.OK)
    async setRequestCourse(@Body() body: SetRequestCourseDto) {
        const result = await this.coursesService.setRequestCourse(
            body.token,
            body.course_id,
            body.user_id,
        );
        return ApiResponse.success(result);
    }
}
