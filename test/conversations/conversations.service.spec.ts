import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from '../../src/conversations/conversations.service.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserRole, UserStatus } from '../../src/enums/users.enum.ts';
import { EventsGateway } from '../../src/events/events.gateway.ts';
import { User, Conversation, Message } from '@prisma/client';

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
    status: UserStatus.ACTIVE,
    online: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockPartner: User = {
    ...mockUser,
    id: 'user-b',
    username: 'userB',
    token: 'tok-b',
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

describe('ConversationsService', () => {
    let service: ConversationsService;
    let prisma: typeof mockPrisma;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConversationsService,
                { provide: PrismaService, useValue: mockPrisma },
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
        prisma = module.get(PrismaService);
    });

    describe('getListConversation', () => {
        it('should return list of conversations with last message data', async () => {
            prisma.conversation.findMany.mockResolvedValue([mockConversation]);
            prisma.message.groupBy.mockResolvedValue([{ conversationId: 'conv-1' }]);
            prisma.message.findFirst.mockResolvedValue(mockMessage);
            prisma.message.count.mockResolvedValue(1);

            const result = await service.getListConversation(mockUser, 0, 10);

            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('conv-1');
            expect(result.numNewMessage).toBe('1');
        });
    });

    describe('getConversation', () => {
        it('should return conversation details and messages', async () => {
            prisma.conversation.findUnique.mockResolvedValue(mockConversation);
            prisma.block.findFirst.mockResolvedValue(null);
            prisma.message.findMany.mockResolvedValue([mockMessage]);

            const result = await service.getConversation(mockUser, 0, 10, undefined, 'conv-1');

            expect(result.conversation.id).toBe('conv-1');
            expect(result.data).toHaveLength(1);
        });
    });
});
