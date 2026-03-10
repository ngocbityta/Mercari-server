import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class SetDevtokenDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    devtype: number;

    @IsString()
    @IsNotEmpty()
    devtoken: string;
}
