import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User, Conversation } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway.ts';
import { UserStatus } from '../enums/users.enum.ts';
import { IConversationQuery, IConversationCommand } from './conversations.interfaces.ts';
import { ApiException } from '../common/exceptions/api.exception.ts';
import { ResponseCode } from '../enums/response-code.enum.ts';

@Injectable()
export class ConversationsService implements IConversationQuery, IConversationCommand {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsGateway: EventsGateway,
    ) {}

    async getListConversation(user: User, index: number, count: number) {
        const conversations = await this.prisma.conversation.findMany({
            where: {
                OR: [{ partnerAId: user.id }, { partnerBId: user.id }],
                isDeleted: false,
            },
            include: {
                partnerA: true,
                partnerB: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip: index,
            take: count,
        });

        const numNewMessageCount = await this.prisma.message.groupBy({
            by: ['conversationId'],
            where: {
                receiverId: user.id,
                isRead: false,
                isDeleted: false,
            },
        });

        const data = await Promise.all(
            conversations.map(async (conv) => {
                const partner = conv.partnerAId === user.id ? conv.partnerB : conv.partnerA;

                const lastMessage = await this.prisma.message.findFirst({
                    where: { conversationId: conv.id, isDeleted: false },
                    orderBy: { createdAt: 'desc' },
                });

                const unreadCount = await this.prisma.message.count({
                    where: {
                        conversationId: conv.id,
                        receiverId: user.id,
                        isRead: false,
                        isDeleted: false,
                    },
                });

                return {
                    id: conv.id,
                    partner: {
                        id: partner?.id ?? '',
                        username: partner?.username ?? '',
                        avatar: partner?.avatar ?? '',
                    },
                    lastmessage: lastMessage
                        ? {
                              message: lastMessage.content ?? '',
                              created: lastMessage.createdAt.toISOString(),
                              unread: unreadCount > 0 ? '1' : '0',
                          }
                        : null,
                    created: conv.createdAt.toISOString(),
                };
            }),
        );

        return {
            data,
            numNewMessage: numNewMessageCount.length.toString(),
        };
    }

    async getConversation(
        user: User,
        index: number,
        count: number,
        partnerId?: string,
        conversationId?: string,
    ) {
        let conversation: (Conversation & { partnerA: User; partnerB: User }) | null = null;

        if (conversationId) {
            conversation = await this.prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { partnerA: true, partnerB: true },
            });
            if (conversation?.isDeleted) {
                conversation = null;
            }
        } else if (partnerId) {
            conversation = await this.prisma.conversation.findFirst({
                where: {
                    OR: [
                        { partnerAId: user.id, partnerBId: partnerId },
                        { partnerAId: partnerId, partnerBId: user.id },
                    ],
                    isDeleted: false,
                },
                include: { partnerA: true, partnerB: true },
            });
        }

        if (!conversation) {
            throw new ApiException(ResponseCode.NO_DATA, 'Conversation not found');
        }

        if (conversation.partnerAId !== user.id && conversation.partnerBId !== user.id) {
            throw new ApiException(ResponseCode.NO_DATA, 'Conversation not found');
        }

        const partner =
            conversation.partnerAId === user.id ? conversation.partnerB : conversation.partnerA;

        let isBlocked = false;
        if (partner) {
            const block = await this.prisma.block.findFirst({
                where: {
                    OR: [
                        { blockerId: user.id, blockedId: partner.id },
                        { blockerId: partner.id, blockedId: user.id },
                    ],
                },
            });
            isBlocked = !!block;
        }

        const messages = await this.prisma.message.findMany({
            where: { conversationId: conversation.id, isDeleted: false },
            orderBy: { createdAt: 'asc' },
            skip: index,
            take: count,
            include: { sender: true, receiver: true },
        });

        return {
            conversation: {
                id: conversation.id,
                partner: {
                    id: partner?.id ?? '',
                    username: partner?.username ?? '',
                    avatar: partner?.avatar ?? '',
                },
                is_blocked: isBlocked ? '1' : '0',
            },
            data: messages.map((m) => ({
                messageId: m.id,
                message: m.content ?? '',
                unread: m.isRead ? '0' : '1',
                created: m.createdAt.toISOString(),
                sender: {
                    id: m.sender?.id ?? '',
                    username: m.sender?.username ?? '',
                    avatar: m.sender?.avatar ?? '',
                },
            })),
        };
    }

    async setReadMessage(user: User, partnerId?: string, conversationId?: string) {
        const conversation = await this.findConversation(user, partnerId, conversationId);

        if (!conversation) {
            throw new ApiException(ResponseCode.NO_DATA, 'Conversation not found');
        }

        await this.prisma.message.updateMany({
            where: {
                conversationId: conversation.id,
                receiverId: user.id,
                isRead: false,
            },
            data: { isRead: true },
        });

        return {};
    }

    async deleteMessage(user: User, messageId: string) {
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            throw new ApiException(ResponseCode.NO_DATA, 'Message not found');
        }

        if (message.senderId !== user.id) {
            throw new ApiException(
                ResponseCode.NOT_ACCESS,
                'You can only delete your own messages',
            );
        }

        await this.prisma.message.update({
            where: { id: messageId },
            data: { isDeleted: true, content: '' },
        });

        return {};
    }

    async deleteConversation(user: User, partnerId?: string, conversationId?: string) {
        const conversation = await this.findConversation(user, partnerId, conversationId);

        if (!conversation) {
            throw new ApiException(ResponseCode.NO_DATA, 'Conversation not found');
        }

        await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { isDeleted: true },
        });

        return {};
    }

    async setSendMessage(
        user: User,
        messageContent: string,
        partnerId?: string,
        conversationId?: string,
    ) {
        let conversation = await this.findConversation(user, partnerId, conversationId);

        if (!conversation && partnerId) {
            const partner = await this.prisma.user.findUnique({ where: { id: partnerId } });
            if (!partner || partner.status === UserStatus.LOCKED) {
                throw new ApiException(ResponseCode.NO_DATA, 'Partner not found');
            }

            const isBlocked = await this.prisma.block.findFirst({
                where: {
                    OR: [
                        { blockerId: user.id, blockedId: partner.id },
                        { blockerId: partner.id, blockedId: user.id },
                    ],
                },
            });
            if (isBlocked) {
                throw new ApiException(ResponseCode.NOT_ACCESS, 'Cannot send message to this user');
            }

            conversation = await this.prisma.conversation.create({
                data: {
                    partnerAId: user.id,
                    partnerBId: partner.id,
                },
            });
        } else if (!conversation) {
            throw new ApiException(ResponseCode.NO_DATA, 'Conversation not found');
        }

        const receiverId =
            conversation.partnerAId === user.id ? conversation.partnerBId : conversation.partnerAId;

        const savedMessage = await this.prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId: user.id,
                receiverId: receiverId,
                content: messageContent,
                isRead: false,
            },
        });

        this.eventsGateway.sendNewMessage(receiverId, {
            conversationId: conversation.id,
            messageId: savedMessage.id,
            message: savedMessage.content ?? '',
            sender_id: user.id,
            createdAt: savedMessage.createdAt.toISOString(),
        });

        return {
            messageId: savedMessage.id,
            conversationId: conversation.id,
            createdAt: savedMessage.createdAt.toISOString(),
        };
    }

    private async findConversation(user: User, partnerId?: string, conversationId?: string) {
        if (conversationId) {
            return this.prisma.conversation.findFirst({
                where: { id: conversationId, isDeleted: false },
            });
        }

        if (partnerId) {
            return this.prisma.conversation.findFirst({
                where: {
                    OR: [
                        { partnerAId: user.id, partnerBId: partnerId },
                        { partnerAId: partnerId, partnerBId: user.id },
                    ],
                    isDeleted: false,
                },
            });
        }

        return null;
    }
}
