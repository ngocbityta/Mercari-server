import { User } from '@prisma/client';

export interface IConversationQuery {
    getListConversation(user: User, index: number, count: number): Promise<any>;
    getConversation(
        user: User,
        index: number,
        count: number,
        partnerId?: string,
        conversationId?: string,
    ): Promise<any>;
}

export interface IConversationCommand {
    setReadMessage(user: User, partnerId?: string, conversationId?: string): Promise<any>;
    deleteMessage(user: User, messageId: string): Promise<any>;
    deleteConversation(user: User, partnerId?: string, conversationId?: string): Promise<any>;
    setSendMessage(
        user: User,
        messageContent: string,
        partnerId?: string,
        conversationId?: string,
    ): Promise<any>;
}
