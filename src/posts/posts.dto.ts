import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class AddPostDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsOptional()
    @IsString()
    left_video?: string;

    @IsOptional()
    @IsString()
    right_video?: string;

    @IsOptional()
    @IsString()
    course_id?: string;

    @IsOptional()
    @IsString()
    exercise_id?: string;

    @IsOptional()
    @IsString()
    described?: string;

    @IsString()
    @IsNotEmpty()
    device_slave: string;

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

    @IsOptional()
    @IsString()
    left_video?: string;

    @IsOptional()
    @IsString()
    right_video?: string;
}

export class GetListPostsDto {
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
    lastId?: string;
}

export class CheckNewItemDto {
    @IsString()
    @IsNotEmpty()
    lastId: string;
}

export class GetSavedSearchDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class SearchPostsDto {
    @IsString()
    @IsNotEmpty()
    q: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    index?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    count?: number;
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
