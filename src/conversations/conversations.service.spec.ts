import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConversationsService } from './conversations.service.ts';
import { Conversation } from '../entities/conversation.entity.ts';
import { Message } from '../entities/message.entity.ts';
import { User } from '../entities/user.entity.ts';
import { Block } from '../entities/block.entity.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';
import { EventsGateway } from '../events/events.gateway.ts';

const mockUser: User = {
    id: 'user-a',
    phonenumber: '0123456789',
    password: 'hash',
    username: 'userA',
    avatar: null,
    cover_image: null,
    description: null,
    role: UserRole.HV,
    token: 'tok-a',
    status: UserStatus.ACTIVE,
    online: false,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockPartner: User = {
    ...mockUser,
    id: 'user-b',
    username: 'userB',
    token: 'tok-b',
};

const mockConversation = {
    id: 'conv-1',
    partner_a_id: 'user-a',
    partner_b_id: 'user-b',
    is_deleted: false,
    created_at: new Date(),
    partner_a: mockUser,
    partner_b: mockPartner,
};

const mockMessage = {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-b',
    receiver_id: 'user-a',
    content: 'Hello',
    is_read: false,
    is_deleted: false,
    created_at: new Date(),
    sender: mockPartner,
    receiver: mockUser,
};

const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
});

describe('ConversationsService', () => {
    let service: ConversationsService;
    let conversationsRepo: Partial<Record<keyof Repository<Conversation>, jest.Mock>> & {
        createQueryBuilder: jest.Mock;
    };
    let messagesRepo: Partial<Record<keyof Repository<Message>, jest.Mock>> & {
        createQueryBuilder: jest.Mock;
    };
    let blocksRepo: Partial<Record<keyof Repository<Block>, jest.Mock>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConversationsService,
                { provide: getRepositoryToken(Conversation), useFactory: mockRepository },
                { provide: getRepositoryToken(Message), useFactory: mockRepository },
                { provide: getRepositoryToken(User), useFactory: mockRepository },
                { provide: getRepositoryToken(Block), useFactory: mockRepository },
                {
                    provide: EventsGateway,
                    useValue: {
                        sendNewMessage: jest.fn(),
                        sendPushNotification: jest.fn(),
                        sendToUser: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ConversationsService>(ConversationsService);
        conversationsRepo = module.get(getRepositoryToken(Conversation));
        messagesRepo = module.get(getRepositoryToken(Message));
        blocksRepo = module.get(getRepositoryToken(Block));
    });

    describe('getListConversation', () => {
        it('should return list of conversations with last message data', async () => {
            const queryBuilderMock = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([mockConversation]),
                getRawOne: jest.fn().mockResolvedValue({ count: '1' }),
            };
            conversationsRepo.createQueryBuilder.mockReturnValue(queryBuilderMock);
            messagesRepo.createQueryBuilder.mockReturnValue(queryBuilderMock);

            messagesRepo.findOne!.mockResolvedValue(mockMessage);
            messagesRepo.count!.mockResolvedValue(1);

            const result = await service.getListConversation(mockUser, 0, 10);

            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('conv-1');
            expect(result.data[0].partner.id).toBe('user-b');
            expect(result.data[0].lastmessage.message).toBe('Hello');
            expect(result.data[0].lastmessage.unread).toBe('1');
            expect(result.numNewMessage).toBe('1');
        });
    });

    describe('getConversation', () => {
        it('should return conversation details and messages using partnerId', async () => {
            const queryBuilderMock = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(mockConversation),
            };
            conversationsRepo.createQueryBuilder.mockReturnValue(queryBuilderMock);
            blocksRepo.findOne!.mockResolvedValue(null);
            messagesRepo.find!.mockResolvedValue([mockMessage]);

            const result = await service.getConversation(mockUser, 0, 10, 'user-b');

            expect(result.conversation.id).toBe('conv-1');
            expect(result.conversation.is_blocked).toBe('0');
            expect(result.data).toHaveLength(1);
            expect(result.data[0].message).toBe('Hello');
            expect(result.data[0].unread).toBe('1');
        });

        it('should throw NotFoundException if user is not in conversation', async () => {
            const mockConvOther = { ...mockConversation, partner_a_id: 'x', partner_b_id: 'y' };
            conversationsRepo.findOne!.mockResolvedValue(mockConvOther);

            await expect(
                service.getConversation(mockUser, 0, 10, undefined, 'conv-1'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException if conversation is deleted', async () => {
            // Because our implementation sets is_deleted:false in the findOne query,
            // the repository will return null for a deleted conversation.
            conversationsRepo.findOne!.mockResolvedValue(null);

            await expect(
                service.getConversation(mockUser, 0, 10, undefined, 'deleted-conv-id'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('setReadMessage', () => {
        it('should mark all unread messages as read', async () => {
            conversationsRepo.findOne!.mockResolvedValue(mockConversation);
            const queryBuilderMock = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue(true),
            };
            messagesRepo.createQueryBuilder.mockReturnValue(queryBuilderMock);

            await service.setReadMessage(mockUser, undefined, 'conv-1');
            expect(queryBuilderMock.execute).toHaveBeenCalled();
        });
    });

    describe('deleteMessage', () => {
        it('should mark message as deleted and clear content', async () => {
            const ownMessage = { ...mockMessage, sender_id: 'user-a' };
            messagesRepo.findOne!.mockResolvedValue(ownMessage);

            await service.deleteMessage(mockUser, 'msg-1');

            expect(ownMessage.is_deleted).toBe(true);
            expect(ownMessage.content).toBe('');
            expect(messagesRepo.save).toHaveBeenCalledWith(ownMessage);
        });

        it('should throw BadRequestException if deleting someone elses message', async () => {
            messagesRepo.findOne!.mockResolvedValue(mockMessage); // sender is user-b

            await expect(service.deleteMessage(mockUser, 'msg-1')).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('deleteConversation', () => {
        it('should mark conversation as deleted', async () => {
            conversationsRepo.findOne!.mockResolvedValue(mockConversation);

            await service.deleteConversation(mockUser, undefined, 'conv-1');

            expect(mockConversation.is_deleted).toBe(true);
            expect(conversationsRepo.save).toHaveBeenCalledWith(mockConversation);
        });
    });
});
