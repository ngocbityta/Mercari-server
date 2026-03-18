import { IsString, IsArray, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class AddPostDto {
    @IsString()
    @IsNotEmpty()
    ownerId: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsArray()
    @IsString({ each: true })
    media: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    hashtags?: string[];
}

export class EditPostDto {
    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    media?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    hashtags?: string[];
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
