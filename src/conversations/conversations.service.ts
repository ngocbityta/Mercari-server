import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity.ts';
import { Message } from '../entities/message.entity.ts';
import { User } from '../entities/user.entity.ts';
import { Block } from '../entities/block.entity.ts';
import { EventsGateway } from '../events/events.gateway.ts';
import { UserStatus } from '../common/enums/user.enum.ts';

@Injectable()
export class ConversationsService {
    constructor(
        @InjectRepository(Conversation)
        private readonly conversationsRepository: Repository<Conversation>,
        @InjectRepository(Message)
        private readonly messagesRepository: Repository<Message>,
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
        @InjectRepository(Block)
        private readonly blocksRepository: Repository<Block>,
        private readonly eventsGateway: EventsGateway,
    ) {}

    async getListConversation(user: User, index: number, count: number) {
        const conversations = await this.conversationsRepository
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.partner_a', 'partner_a')
            .leftJoinAndSelect('c.partner_b', 'partner_b')
            .where('(c.partner_a_id = :userId OR c.partner_b_id = :userId)', { userId: user.id })
            .andWhere('c.is_deleted = false')
            .orderBy('c.created_at', 'DESC')
            .skip(index)
            .take(count)
            .getMany();

        const numNewMessage = await this.messagesRepository
            .createQueryBuilder('m')
            .innerJoin('m.conversation', 'c')
            .where('m.receiver_id = :userId', { userId: user.id })
            .andWhere('m.is_read = false')
            .andWhere('m.is_deleted = false')
            .select('COUNT(DISTINCT m.conversation_id)', 'count')
            .getRawOne<{ count: string }>();

        const data = await Promise.all(
            conversations.map(async (conv) => {
                const partner = conv.partner_a_id === user.id ? conv.partner_b : conv.partner_a;

                const lastMessage = await this.messagesRepository.findOne({
                    where: { conversation_id: conv.id, is_deleted: false },
                    order: { created_at: 'DESC' },
                });

                const unread = await this.messagesRepository.count({
                    where: {
                        conversation_id: conv.id,
                        receiver_id: user.id,
                        is_read: false,
                        is_deleted: false,
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
                              created: lastMessage.created_at.toISOString(),
                              unread: unread > 0 ? '1' : '0',
                          }
                        : null,
                    created: conv.created_at.toISOString(),
                };
            }),
        );

        return {
            data,
            numNewMessage: numNewMessage?.count ?? '0',
        };
    }

    async getConversation(
        user: User,
        index: number,
        count: number,
        partnerId?: string,
        conversationId?: string,
    ) {
        let conversation: Conversation | null = null;

        if (conversationId) {
            conversation = await this.conversationsRepository.findOne({
                where: { id: conversationId, is_deleted: false },
                relations: ['partner_a', 'partner_b'],
            });
        } else if (partnerId) {
            conversation = await this.conversationsRepository
                .createQueryBuilder('c')
                .leftJoinAndSelect('c.partner_a', 'partner_a')
                .leftJoinAndSelect('c.partner_b', 'partner_b')
                .where(
                    '((c.partner_a_id = :userId AND c.partner_b_id = :partnerId) OR (c.partner_a_id = :partnerId AND c.partner_b_id = :userId))',
                    { userId: user.id, partnerId },
                )
                .andWhere('c.is_deleted = false')
                .getOne();
        }

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        if (conversation.partner_a_id !== user.id && conversation.partner_b_id !== user.id) {
            throw new NotFoundException('Conversation not found');
        }

        const partner =
            conversation.partner_a_id === user.id ? conversation.partner_b : conversation.partner_a;

        let isBlocked = false;
        if (partner) {
            const block = await this.blocksRepository.findOne({
                where: [
                    { blocker_id: user.id, blocked_id: partner.id },
                    { blocker_id: partner.id, blocked_id: user.id },
                ],
            });
            isBlocked = !!block;
        }

        const messages = await this.messagesRepository.find({
            where: { conversation_id: conversation.id, is_deleted: false },
            order: { created_at: 'ASC' },
            skip: index,
            take: count,
            relations: ['sender', 'receiver'],
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
                message_id: m.id,
                message: m.content ?? '',
                unread: m.is_read ? '0' : '1',
                created: m.created_at.toISOString(),
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
            throw new NotFoundException('Conversation not found');
        }

        await this.messagesRepository
            .createQueryBuilder()
            .update(Message)
            .set({ is_read: true })
            .where('conversation_id = :convId', { convId: conversation.id })
            .andWhere('receiver_id = :userId', { userId: user.id })
            .andWhere('is_read = false')
            .execute();

        return {};
    }

    async deleteMessage(user: User, messageId: string) {
        const message = await this.messagesRepository.findOne({
            where: { id: messageId },
        });

        if (!message) {
            throw new NotFoundException('Message not found');
        }

        if (message.sender_id !== user.id) {
            throw new BadRequestException('You can only delete your own messages');
        }

        message.is_deleted = true;
        message.content = '';
        await this.messagesRepository.save(message);

        return {};
    }

    async deleteConversation(user: User, partnerId?: string, conversationId?: string) {
        const conversation = await this.findConversation(user, partnerId, conversationId);

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        conversation.is_deleted = true;
        await this.conversationsRepository.save(conversation);

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
            const partner = await this.usersRepository.findOne({ where: { id: partnerId } });
            if (!partner || partner.status === UserStatus.LOCKED) {
                throw new NotFoundException('Partner not found');
            }

            const isBlocked = await this.blocksRepository.findOne({
                where: [
                    { blocker_id: user.id, blocked_id: partner.id },
                    { blocker_id: partner.id, blocked_id: user.id },
                ],
            });
            if (isBlocked) {
                throw new BadRequestException('Cannot send message to this user');
            }

            conversation = this.conversationsRepository.create({
                partner_a_id: user.id,
                partner_b_id: partner.id,
            });
            conversation = await this.conversationsRepository.save(conversation);
        } else if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        const receiverId =
            conversation.partner_a_id === user.id
                ? conversation.partner_b_id
                : conversation.partner_a_id;

        const message = this.messagesRepository.create({
            conversation_id: conversation.id,
            sender_id: user.id,
            receiver_id: receiverId,
            content: messageContent,
            is_read: false,
        });
        const savedMessage = await this.messagesRepository.save(message);

        this.eventsGateway.sendNewMessage(receiverId, {
            conversation_id: conversation.id,
            message_id: savedMessage.id,
            message: savedMessage.content,
            sender_id: user.id,
            created_at: savedMessage.created_at.toISOString(),
        });

        return {
            message_id: savedMessage.id,
            conversation_id: conversation.id,
            created_at: savedMessage.created_at.toISOString(),
        };
    }

    private async findConversation(
        user: User,
        partnerId?: string,
        conversationId?: string,
    ): Promise<Conversation | null> {
        if (conversationId) {
            return this.conversationsRepository.findOne({
                where: { id: conversationId, is_deleted: false },
            });
        }

        if (partnerId) {
            return this.conversationsRepository
                .createQueryBuilder('c')
                .where(
                    '((c.partner_a_id = :userId AND c.partner_b_id = :partnerId) OR (c.partner_a_id = :partnerId AND c.partner_b_id = :userId))',
                    { userId: user.id, partnerId },
                )
                .andWhere('c.is_deleted = false')
                .getOne();
        }

        return null;
    }
}
