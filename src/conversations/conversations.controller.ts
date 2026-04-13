import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ConversationsService } from './conversations.service.ts';
import {
    GetListConversationDto,
    GetConversationDto,
    SetReadMessageDto,
    DeleteMessageDto,
    DeleteConversationDto,
    SetSendMessageDto,
} from './conversations.dto.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';
import { CurrentUser } from '../common/decorators/current-user.decorator.ts';
import type { User } from '@prisma/client';
import { ApiResponse } from '../common/dto/api-response.dto.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';
import { ApiException } from '../common/exceptions/api.exception.ts';

@Controller()
export class ConversationsController {
    constructor(private readonly conversationsService: ConversationsService) {}

    @Post('get_list_conversation')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getListConversation(@Body() dto: GetListConversationDto, @CurrentUser() user: User) {
        const index = parseInt(dto.index, 10);
        const count = parseInt(dto.count, 10);

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Parameter value is invalid',
            );
        }

        const result = await this.conversationsService.getListConversation(user, index, count);
        return ApiResponse.success(result);
    }

    @Post('get_conversation')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getConversation(@Body() dto: GetConversationDto, @CurrentUser() user: User) {
        const index = parseInt(dto.index, 10);
        const count = parseInt(dto.count, 10);

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Parameter value is invalid',
            );
        }

        if (!dto.partnerId && !dto.conversationId) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Either partner_id or conversation_id is required',
            );
        }

        const result = await this.conversationsService.getConversation(
            user,
            index,
            count,
            dto.partnerId,
            dto.conversationId,
        );
        return ApiResponse.success(result);
    }

    @Post('set_read_message')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setReadMessage(@Body() dto: SetReadMessageDto, @CurrentUser() user: User) {
        if (!dto.partnerId && !dto.conversationId) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Either partner_id or conversation_id is required',
            );
        }

        const result = await this.conversationsService.setReadMessage(
            user,
            dto.partnerId,
            dto.conversationId,
        );
        return ApiResponse.success(result);
    }

    @Post('set_send_message')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setSendMessage(@Body() dto: SetSendMessageDto, @CurrentUser() user: User) {
        if (!dto.partnerId && !dto.conversationId) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Either partner_id or conversation_id is required',
            );
        }

        const result = await this.conversationsService.setSendMessage(
            user,
            dto.message,
            dto.partnerId,
            dto.conversationId,
        );
        return ApiResponse.success(result);
    }

    @Post('delete_message')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async deleteMessage(@Body() dto: DeleteMessageDto, @CurrentUser() user: User) {
        const result = await this.conversationsService.deleteMessage(user, dto.messageId);
        return ApiResponse.success(result);
    }

    @Post('delete_conversation')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async deleteConversation(@Body() dto: DeleteConversationDto, @CurrentUser() user: User) {
        if (!dto.partnerId && !dto.conversationId) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Either partner_id or conversation_id is required',
            );
        }

        const result = await this.conversationsService.deleteConversation(
            user,
            dto.partnerId,
            dto.conversationId,
        );
        return ApiResponse.success(result);
    }
}
