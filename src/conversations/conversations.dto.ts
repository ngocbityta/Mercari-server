import { IsNotEmpty, IsString, IsOptional, IsNumberString } from 'class-validator';

export class GetListConversationDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsNumberString()
    @IsNotEmpty()
    index: string;

    @IsNumberString()
    @IsNotEmpty()
    count: string;
}

export class GetConversationDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsNumberString()
    @IsNotEmpty()
    index: string;

    @IsNumberString()
    @IsNotEmpty()
    count: string;

    @IsString()
    @IsOptional()
    partnerId?: string;

    @IsString()
    @IsOptional()
    conversationId?: string;
}

export class SetReadMessageDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    partnerId?: string;

    @IsString()
    @IsOptional()
    conversationId?: string;
}

export class DeleteMessageDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    messageId: string;
}

export class DeleteConversationDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    partnerId?: string;

    @IsString()
    @IsOptional()
    conversationId?: string;
}

export class SetSendMessageDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    partnerId?: string;

    @IsString()
    @IsOptional()
    conversationId?: string;

    @IsString()
    @IsNotEmpty()
    message: string;
}
