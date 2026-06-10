import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class AddPostDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsOptional()
    @IsString()
    course_id?: string;

    @IsOptional()
    @IsString()
    exercise_id?: string;

    @IsOptional()
    @IsString()
    described?: string;

    @IsOptional()
    @IsString()
    device_slave?: string;

    @IsString()
    @IsNotEmpty()
    device_master: string;
}

export class GetPostDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    id: string;

    @IsOptional()
    @IsString()
    user_id?: string;
}

export class EditPostDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    id: string;

    @IsOptional()
    @IsString()
    described?: string;

    @IsOptional()
    @IsString()
    video_indices?: string;
}

export class GetListPostsDto {
    @IsOptional()
    @IsString()
    token?: string;

    @IsOptional()
    @IsString()
    category_id?: string;

    @IsString()
    @IsNotEmpty()
    index: string;

    @IsString()
    @IsNotEmpty()
    count: string;

    @IsOptional()
    @IsString()
    last_id?: string;

    @IsOptional()
    @IsString()
    user_id?: string;
}

export class CheckNewItemDto {
    @IsOptional()
    @IsString()
    last_id?: string;

    @IsString()
    category_id: string;
}

export class GetSavedSearchDto {
    @IsNotEmpty()
    @IsString()
    token: string;

    @IsNotEmpty()
    @IsString()
    index: string;

    @IsNotEmpty()
    @IsString()
    count: string;

    @IsOptional()
    @IsString()
    user_id?: string;
}

export class SearchPostsDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    keyword: string;

    @IsOptional()
    @IsString()
    category_id?: string;

    @IsOptional()
    @IsString()
    duration_min?: string;

    @IsOptional()
    @IsString()
    duration_max?: string;

    @IsOptional()
    @IsString()
    user_id?: string;

    @IsString()
    @IsNotEmpty()
    index: string;

    @IsString()
    @IsNotEmpty()
    count: string;
}

export class GetCommentDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    id: string;

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

export class LikePostDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    id: string;
}

export class ReportPostDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsString()
    @IsNotEmpty()
    details: string;
}

export class SetCommentDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    id: string;

    @IsOptional()
    @IsString()
    comment?: string;

    @IsString()
    @IsNotEmpty()
    index: string;

    @IsString()
    @IsNotEmpty()
    count: string;

    @IsOptional()
    @IsString()
    score?: string;

    @IsOptional()
    @IsString()
    detail_mistakes?: string;
}

export class DelSavedSearchDto {
    @IsNotEmpty()
    @IsString()
    token: string;

    @IsOptional()
    @IsString()
    search_id?: string;

    @IsOptional()
    @IsString()
    all?: string; // "1" for all, "0" for single
}

export class RegradePostDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    id: string;
}

export class GetListReportsDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    index: string;

    @IsString()
    @IsNotEmpty()
    count: string;
}
