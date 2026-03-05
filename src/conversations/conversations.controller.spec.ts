import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller.ts';
import { ConversationsService } from './conversations.service.ts';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';
import { User } from '../entities/user.entity.ts';
import { ResponseCode } from '../common/enums/response-code.enum.ts';
import { TokenGuard } from '../common/guards/token.guard.ts';

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

const mockConversationsService = {
    getListConversation: jest.fn(),
    getConversation: jest.fn(),
    setReadMessage: jest.fn(),
    deleteMessage: jest.fn(),
    deleteConversation: jest.fn(),
    setSendMessage: jest.fn(),
};

describe('ConversationsController', () => {
    let controller: ConversationsController;
    let service: typeof mockConversationsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ConversationsController],
            providers: [
                {
                    provide: ConversationsService,
                    useValue: mockConversationsService,
                },
            ],
        })
            .overrideGuard(TokenGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<ConversationsController>(ConversationsController);
        service = module.get(ConversationsService);
    });

    describe('getListConversation', () => {
        it('should return success response', async () => {
            service.getListConversation.mockResolvedValue({ data: [], numNewMessage: '0' });
            const result = await controller.getListConversation(
                { token: 'tok', index: '0', count: '10' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.OK);
            expect(service.getListConversation).toHaveBeenCalledWith(mockUser, 0, 10);
        });

        it('should return error on invalid index', async () => {
            const result = await controller.getListConversation(
                { token: 'tok', index: 'bad', count: '10' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });
    });

    describe('getConversation', () => {
        it('should return success response', async () => {
            service.getConversation.mockResolvedValue({ conversation: {}, data: [] });
            const result = await controller.getConversation(
                { token: 'tok', index: '0', count: '10', partner_id: 'x' },
                mockUser,
            );

            expect(result.code).toBe(ResponseCode.OK);
        });

        it('should return error if missing both partner_id and conversation_id', async () => {
            const result = await controller.getConversation(
                { token: 'tok', index: '0', count: '10' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });
    });

    describe('setReadMessage', () => {
        it('should call service and return OK', async () => {
            service.setReadMessage.mockResolvedValue({});
            const result = await controller.setReadMessage(
                { token: 'tok', partner_id: 'x' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.OK);
        });
    });

    describe('deleteMessage', () => {
        it('should call service and return OK', async () => {
            service.deleteMessage.mockResolvedValue({});
            const result = await controller.deleteMessage(
                { token: 'tok', message_id: 'msg-1' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.OK);
        });
    });

    describe('deleteConversation', () => {
        it('should call service and return OK', async () => {
            service.deleteConversation.mockResolvedValue({});
            const result = await controller.deleteConversation(
                { token: 'tok', partner_id: 'x' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.OK);
        });
    });

    describe('setSendMessage', () => {
        beforeEach(() => {
            // Re-bind the controller and service for this specific suit
            controller = new ConversationsController(service as unknown as ConversationsService);
        });

        it('should call service and return OK', async () => {
            service.setSendMessage.mockResolvedValue({});
            const result = await controller.setSendMessage(
                { token: 'tok', partner_id: 'x', message: 'hello' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.OK);
        });

        it('should return error if missing both partner_id and conversation_id', async () => {
            const result = await controller.setSendMessage(
                { token: 'tok', message: 'hello' },
                mockUser,
            );
            expect(result.code).toBe(ResponseCode.INVALID_PARAMETER_VALUE);
        });
    });
});
