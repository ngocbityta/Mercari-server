import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SetApproveEnrollmentDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    user_id: string;

    @IsString()
    @IsNotEmpty()
    is_accept: string;
}

export class SetRequestCourseDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    course_id: string;

    @IsString()
    @IsNotEmpty()
    user_id: string;
}

export class GetListStudentsDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    index: string;

    @IsString()
    @IsNotEmpty()
    count: string;

    @IsOptional()
    @IsString()
    user_id?: string;
}

export class GetRequestedEnrollmentDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    index: string;

    @IsString()
    @IsNotEmpty()
    count: string;

    @IsOptional()
    @IsString()
    user_id?: string;
}
