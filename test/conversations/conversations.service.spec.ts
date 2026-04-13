import { ConversationsService } from '../../src/conversations/conversations.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { EventsGateway } from '../../src/events/events.gateway.ts';
import { User, Conversation, Message } from '@prisma/client';
import { ApiException } from '../../src/common/exceptions/api.exception.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { Test, TestingModule } from '@nestjs/testing';

const mockUser: User = {
    id: 'user-a',
    phonenumber: '0123456789',
    password: 'hash',
    username: 'userA',
    avatar: null,
    coverImage: null,
    description: null,
    role: UserRole.HV,
    token: 'tok-a',
    height: null,
    status: UserStatus.ACTIVE,
    online: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockPartner: User = {
    ...mockUser,
    id: 'user-b',
    phonenumber: '0987654321',
    username: 'userB',
    token: 'tok-b',
};

const mockLockedPartner: User = {
    ...mockPartner,
    id: 'user-locked',
    status: UserStatus.LOCKED,
};

const mockConversation: Conversation & { partnerA: User; partnerB: User } = {
    id: 'conv-1',
    partnerAId: 'user-a',
    partnerBId: 'user-b',
    isDeleted: false,
    createdAt: new Date(),
    partnerA: mockUser,
    partnerB: mockPartner,
};

const mockMessage: Message = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-b',
    receiverId: 'user-a',
    content: 'Hello',
    isRead: false,
    isDeleted: false,
    createdAt: new Date(),
};

const mockSentMessage: Message = {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderId: 'user-a',
    receiverId: 'user-b',
    content: 'Hi back',
    isRead: false,
    isDeleted: false,
    createdAt: new Date(),
};

const mockEventsGateway = {
    sendNewMessage: jest.fn(),
    sendPushNotification: jest.fn(),
    sendToUser: jest.fn(),
};

const mockPrisma = {
    conversation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    message: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
    block: {
        findFirst: jest.fn(),
    },
};

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

describe('ConversationsService', () => {
    let service: ConversationsService;
    let prisma: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConversationsService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: EventsGateway, useValue: mockEventsGateway },
            ],
        }).compile();

        service = module.get<ConversationsService>(ConversationsService);
        prisma = module.get(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getListConversation', () => {
        it('TC1: should return list of conversations with last message data', async () => {
            prisma.conversation.findMany.mockResolvedValue([mockConversation]);
            prisma.message.groupBy.mockResolvedValue([{ conversationId: 'conv-1' }]);
            prisma.message.findFirst.mockResolvedValue(mockMessage);
            prisma.message.count.mockResolvedValue(1);

            const result = await service.getListConversation(mockUser, 0, 10);

            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('conv-1');
            expect(result.data[0].partner.id).toBe('user-b');
            expect(result.numNewMessage).toBe('1');
        });

        it('should return empty list when no conversations exist', async () => {
            prisma.conversation.findMany.mockResolvedValue([]);
            prisma.message.groupBy.mockResolvedValue([]);

            const result = await service.getListConversation(mockUser, 0, 10);

            expect(result.data).toHaveLength(0);
            expect(result.numNewMessage).toBe('0');
        });

        it('should handle conversation with no messages', async () => {
            prisma.conversation.findMany.mockResolvedValue([mockConversation]);
            prisma.message.groupBy.mockResolvedValue([]);
            prisma.message.findFirst.mockResolvedValue(null);
            prisma.message.count.mockResolvedValue(0);

            const result = await service.getListConversation(mockUser, 0, 10);

            expect(result.data[0].lastmessage).toBeNull();
        });

        it('TC5: should still show partner info even with null fields', async () => {
            const convWithNullPartner = {
                ...mockConversation,
                partnerB: { ...mockPartner, username: null, avatar: null },
            };
            prisma.conversation.findMany.mockResolvedValue([convWithNullPartner]);
            prisma.message.groupBy.mockResolvedValue([]);
            prisma.message.findFirst.mockResolvedValue(null);
            prisma.message.count.mockResolvedValue(0);

            const result = await service.getListConversation(mockUser, 0, 10);

            expect(result.data[0].partner.username).toBe('');
            expect(result.data[0].partner.avatar).toBe('');
        });
    });

    describe('getConversation', () => {
        it('TC1: should return conversation details and messages by conversation_id', async () => {
            prisma.conversation.findUnique.mockResolvedValue(mockConversation);
            prisma.block.findFirst.mockResolvedValue(null);
            prisma.message.findMany.mockResolvedValue([
                { ...mockMessage, sender: mockPartner, receiver: mockUser },
            ]);

            const result = await service.getConversation(mockUser, 0, 10, undefined, 'conv-1');

            expect(result.conversation.id).toBe('conv-1');
            expect(result.conversation.partner.id).toBe('user-b');
            expect(result.conversation.is_blocked).toBe('0');
            expect(result.data).toHaveLength(1);
        });

        it('TC1b: should return conversation by partner_id', async () => {
            prisma.conversation.findFirst.mockResolvedValue(mockConversation);
            prisma.block.findFirst.mockResolvedValue(null);
            prisma.message.findMany.mockResolvedValue([]);

            const result = await service.getConversation(mockUser, 0, 10, 'user-b', undefined);

            expect(result.conversation.id).toBe('conv-1');
        });

        it('TC5: should throw ApiException when conversation not found', async () => {
            prisma.conversation.findUnique.mockResolvedValue(null);

            const call = () => service.getConversation(mockUser, 0, 10, undefined, 'nonexistent');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });

        it('should indicate blocked status when block exists', async () => {
            prisma.conversation.findUnique.mockResolvedValue(mockConversation);
            prisma.block.findFirst.mockResolvedValue({
                blockerId: 'user-a',
                blockedId: 'user-b',
            });
            prisma.message.findMany.mockResolvedValue([]);

            const result = await service.getConversation(mockUser, 0, 10, undefined, 'conv-1');

            expect(result.conversation.is_blocked).toBe('1');
        });

        it('should skip deleted conversations', async () => {
            const deletedConv = { ...mockConversation, isDeleted: true };
            prisma.conversation.findUnique.mockResolvedValue(deletedConv);

            const call = () => service.getConversation(mockUser, 0, 10, undefined, 'conv-1');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });
    });

    describe('setReadMessage', () => {
        it('TC1: should mark all messages as read in a conversation', async () => {
            prisma.conversation.findFirst.mockResolvedValue(mockConversation);
            prisma.message.updateMany.mockResolvedValue({ count: 2 });

            const result = await service.setReadMessage(mockUser, undefined, 'conv-1');

            expect(prisma.message.updateMany).toHaveBeenCalledWith({
                where: {
                    conversationId: 'conv-1',
                    receiverId: mockUser.id,
                    isRead: false,
                },
                data: { isRead: true },
            });
            expect(result).toEqual({});
        });

        it('should throw ApiException when conversation not found', async () => {
            prisma.conversation.findFirst.mockResolvedValue(null);

            const call = () => service.setReadMessage(mockUser, undefined, 'nonexistent');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });

        it('should work with partner_id instead of conversation_id', async () => {
            prisma.conversation.findFirst.mockResolvedValue(mockConversation);
            prisma.message.updateMany.mockResolvedValue({ count: 1 });

            const result = await service.setReadMessage(mockUser, 'user-b', undefined);

            expect(result).toEqual({});
        });
    });

    describe('deleteMessage', () => {
        it('TC1: should delete own message successfully', async () => {
            prisma.message.findUnique.mockResolvedValue(mockSentMessage);
            prisma.message.update.mockResolvedValue({
                ...mockSentMessage,
                isDeleted: true,
                content: '',
            });

            const result = await service.deleteMessage(mockUser, 'msg-2');

            expect(prisma.message.update).toHaveBeenCalledWith({
                where: { id: 'msg-2' },
                data: { isDeleted: true, content: '' },
            });
            expect(result).toEqual({});
        });

        it('should throw ApiException when message does not exist', async () => {
            prisma.message.findUnique.mockResolvedValue(null);

            const call = () => service.deleteMessage(mockUser, 'nonexistent');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });

        it('should throw error when trying to delete message from another user', async () => {
            prisma.message.findUnique.mockResolvedValue(mockMessage); // sent by user-b

            const call = () => service.deleteMessage(mockUser, 'msg-1');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NOT_ACCESS);
            }
        });
    });

    describe('deleteConversation', () => {
        it('TC1: should delete conversation by conversation_id', async () => {
            prisma.conversation.findFirst.mockResolvedValue(mockConversation);
            prisma.conversation.update.mockResolvedValue({
                ...mockConversation,
                isDeleted: true,
            });

            const result = await service.deleteConversation(mockUser, undefined, 'conv-1');

            expect(prisma.conversation.update).toHaveBeenCalledWith({
                where: { id: 'conv-1' },
                data: { isDeleted: true },
            });
            expect(result).toEqual({});
        });

        it('TC1b: should delete conversation by partner_id', async () => {
            prisma.conversation.findFirst.mockResolvedValue(mockConversation);
            prisma.conversation.update.mockResolvedValue({
                ...mockConversation,
                isDeleted: true,
            });

            const result = await service.deleteConversation(mockUser, 'user-b', undefined);

            expect(result).toEqual({});
        });

        it('TC6: should throw error when conversation does not exist', async () => {
            prisma.conversation.findFirst.mockResolvedValue(null);

            const call = () => service.deleteConversation(mockUser, undefined, 'nonexistent');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });
    });

    describe('setSendMessage', () => {
        it('TC1: should send message to existing conversation', async () => {
            prisma.conversation.findFirst.mockResolvedValue(mockConversation);
            prisma.message.create.mockResolvedValue({
                ...mockSentMessage,
                content: 'Hello!',
                createdAt: new Date(),
            });

            const result = await service.setSendMessage(mockUser, 'Hello!', undefined, 'conv-1');

            expect(result).toHaveProperty('messageId');
            expect(result).toHaveProperty('conversationId');
            expect(result).toHaveProperty('createdAt');
            expect(mockEventsGateway.sendNewMessage).toHaveBeenCalled();
        });

        it('should create new conversation if none exists with partner', async () => {
            prisma.conversation.findFirst.mockResolvedValue(null);
            prisma.user.findUnique.mockResolvedValue(mockPartner);
            prisma.block.findFirst.mockResolvedValue(null);
            const newConv = {
                ...mockConversation,
                id: 'conv-new',
            };
            prisma.conversation.create.mockResolvedValue(newConv);
            prisma.message.create.mockResolvedValue({
                ...mockSentMessage,
                conversationId: 'conv-new',
                content: 'Hi!',
                createdAt: new Date(),
            });

            const result = await service.setSendMessage(mockUser, 'Hi!', 'user-b', undefined);

            expect(prisma.conversation.create).toHaveBeenCalled();
            expect(result).toHaveProperty('messageId');
        });

        it('should throw error when partner is blocked', async () => {
            prisma.conversation.findFirst.mockResolvedValue(null);
            prisma.user.findUnique.mockResolvedValue(mockPartner);
            prisma.block.findFirst.mockResolvedValue({
                blockerId: 'user-a',
                blockedId: 'user-b',
            });

            const call = () => service.setSendMessage(mockUser, 'Hi!', 'user-b', undefined);
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NOT_ACCESS);
            }
        });

        it('TC5: should throw error when partner does not exist', async () => {
            prisma.conversation.findFirst.mockResolvedValue(null);
            prisma.user.findUnique.mockResolvedValue(null);

            const call = () => service.setSendMessage(mockUser, 'Hi!', 'nonexistent', undefined);
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });

        it('should throw error when partner is locked', async () => {
            prisma.conversation.findFirst.mockResolvedValue(null);
            prisma.user.findUnique.mockResolvedValue(mockLockedPartner);

            const call = () => service.setSendMessage(mockUser, 'Hi!', 'user-locked', undefined);
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });

        it('should throw error when no conversation found and no partner_id', async () => {
            prisma.conversation.findFirst.mockResolvedValue(null);

            const call = () => service.setSendMessage(mockUser, 'Hi!', undefined, 'nonexistent');
            await expect(call()).rejects.toThrow(ApiException);
            try {
                await call();
            } catch (e) {
                expect((e as ApiException).code).toBe(ResponseCode.NO_DATA);
            }
        });
    });
});
