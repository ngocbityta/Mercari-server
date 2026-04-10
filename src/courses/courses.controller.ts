import { Controller, Post, Body } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { GetListStudentsDto, GetRequestedEnrollmentDto } from './courses.dto';

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
}
