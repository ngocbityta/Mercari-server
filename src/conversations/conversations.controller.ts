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

@Controller()
export class ConversationsController {
    constructor(private readonly conversationsService: ConversationsService) {}

    @Post('get_list_conversation')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getListConversation(@Body() dto: GetListConversationDto, @CurrentUser() user: User) {
        try {
            const index = parseInt(dto.index, 10);
            const count = parseInt(dto.count, 10);

            if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
                return ApiResponse.error(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Parameter value is invalid',
                );
            }

            const result = await this.conversationsService.getListConversation(user, index, count);
            return ApiResponse.success(result);
        } catch {
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('get_conversation')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async getConversation(@Body() dto: GetConversationDto, @CurrentUser() user: User) {
        try {
            const index = parseInt(dto.index, 10);
            const count = parseInt(dto.count, 10);

            if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
                return ApiResponse.error(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Parameter value is invalid',
                );
            }

            if (!dto.partnerId && !dto.conversationId) {
                return ApiResponse.error(
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
        } catch (error) {
            if (error instanceof Error && error.message === 'Conversation not found') {
                return ApiResponse.error(ResponseCode.NO_DATA, 'Conversation not found');
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('set_read_message')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setReadMessage(@Body() dto: SetReadMessageDto, @CurrentUser() user: User) {
        try {
            if (!dto.partnerId && !dto.conversationId) {
                return ApiResponse.error(
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
        } catch (error) {
            if (error instanceof Error && error.message === 'Conversation not found') {
                return ApiResponse.error(ResponseCode.NO_DATA, 'Conversation not found');
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('set_send_message')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async setSendMessage(@Body() dto: SetSendMessageDto, @CurrentUser() user: User) {
        try {
            if (!dto.partnerId && !dto.conversationId) {
                return ApiResponse.error(
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
        } catch (error) {
            if (error instanceof Error) {
                if (
                    error.message === 'Conversation not found' ||
                    error.message === 'Partner not found'
                ) {
                    return ApiResponse.error(ResponseCode.NO_DATA, error.message);
                } else if (error.message === 'Cannot send message to this user') {
                    return ApiResponse.error(ResponseCode.INVALID_PARAMETER_VALUE, error.message);
                }
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('delete_message')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async deleteMessage(@Body() dto: DeleteMessageDto, @CurrentUser() user: User) {
        try {
            const result = await this.conversationsService.deleteMessage(user, dto.messageId);
            return ApiResponse.success(result);
        } catch (error) {
            if (error instanceof Error && error.message === 'Message not found') {
                return ApiResponse.error(ResponseCode.NO_DATA, 'Message not found');
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }

    @Post('delete_conversation')
    @HttpCode(HttpStatus.OK)
    @UseGuards(TokenGuard)
    async deleteConversation(@Body() dto: DeleteConversationDto, @CurrentUser() user: User) {
        try {
            if (!dto.partnerId && !dto.conversationId) {
                return ApiResponse.error(
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
        } catch (error) {
            if (error instanceof Error && error.message === 'Conversation not found') {
                return ApiResponse.error(ResponseCode.NO_DATA, 'Conversation not found');
            }
            return ApiResponse.error(ResponseCode.EXCEPTION_ERROR, 'Exception error');
        }
    }
}
