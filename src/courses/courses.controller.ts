import { Controller, Post, Body } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { GetRequestedEnrollmentDto } from './courses.dto';

@Controller()
export class CoursesController {
    constructor(private coursesService: CoursesService) {}

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
