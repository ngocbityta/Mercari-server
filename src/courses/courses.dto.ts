import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
