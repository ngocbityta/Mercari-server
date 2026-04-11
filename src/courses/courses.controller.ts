import { Controller, Post, Body } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { GetListStudentsDto, GetRequestedEnrollmentDto, SetRequestCourseDto } from './courses.dto';

@Controller()
export class CoursesController {
    constructor(private coursesService: CoursesService) {}

    @Post('get_list_students')
    async getListStudents(@Body() body: GetListStudentsDto) {
        return this.coursesService.getListStudents(
            body.token,
            parseInt(body.index),
            parseInt(body.count),
            body.user_id,
        );
    }

    @Post('get_requested_enrollment')
    async getRequestedEnrollment(@Body() body: GetRequestedEnrollmentDto) {
        return this.coursesService.getRequestedEnrollment(
            body.token,
            parseInt(body.index),
            parseInt(body.count),
            body.user_id,
        );
    }

    @Post('set_request_coures')
    async setRequestCourse(@Body() body: SetRequestCourseDto) {
        return this.coursesService.setRequestCourse(body.token, body.course_id, body.user_id);
    }
}
