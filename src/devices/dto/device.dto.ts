import { IsNotEmpty, IsString } from 'class-validator';

export class SetDevtokenDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    devtype: string;

    @IsString()
    @IsNotEmpty()
    devtoken: string;
}
