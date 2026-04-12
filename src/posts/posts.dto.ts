import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class AddPostDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    left_video: string;

    @IsString()
    @IsNotEmpty()
    right_video: string;

    @IsOptional()
    @IsString()
    course_id?: string;

    @IsOptional()
    @IsString()
    exercise_id?: string;

    @IsString()
    @IsNotEmpty()
    described: string;

    @IsString()
    @IsNotEmpty()
    device_slave: string;

    @IsOptional()
    @IsString()
    device_master?: string;
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

    @IsOptional()
    @IsString()
    left_video?: string;

    @IsOptional()
    @IsString()
    right_video?: string;
}

export class GetListPostsDto {
    @IsOptional()
    @IsString()
    token?: string;

    @IsOptional()
    @IsString()
    id?: string;

    @IsOptional()
    @IsString()
    category_id?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    index?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    count?: number;

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

    @IsOptional()
    @IsString()
    index?: string;

    @IsOptional()
    @IsString()
    count?: string;

    @IsOptional()
    @IsString()
    user_id?: string;
}

export class SearchPostsDto {
    @IsOptional()
    @IsString()
    token?: string;

    @IsOptional()
    @IsString()
    keyword?: string;

    @IsString()
    @IsNotEmpty()
    category_id: string;

    @IsString()
    @IsNotEmpty()
    duration_min: string;

    @IsString()
    @IsNotEmpty()
    duration_max: string;

    @IsOptional()
    @IsString()
    user_id?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    index?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    count?: number;
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

    @IsNotEmpty()
    @IsString()
    all: string; // "1" for all, "0" for single
}
