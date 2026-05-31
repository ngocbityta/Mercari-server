import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.ts';
import { ConversationsService } from '../conversations/conversations.service.ts';
import { UserStatus } from '../enums/users.enum.ts';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger: Logger = new Logger('EventsGateway');

    private connectedUsers = new Map<string, string>();
    private socketToUserId = new Map<string, string>();
    private socketTimeouts = new Map<string, NodeJS.Timeout>();
    private socketLastActive = new Map<string, number>();

    constructor(
        private prisma: PrismaService,
        private moduleRef: ModuleRef
    ) {}

    private get conversationsService(): ConversationsService {
        return this.moduleRef.get(ConversationsService, { strict: false });
    }

    afterInit(_server: Server) {
        this.logger.log('EventsGateway initialized');
    }

    async handleConnection(client: Socket, ..._args: any[]) {
        this.logger.log(`Client connected: ${client.id}`);
        const userId = client.handshake.query.userId as string;
        
        if (userId) {
            this.connectedUsers.set(userId, client.id);
            this.socketToUserId.set(client.id, userId);
            this.socketLastActive.set(client.id, Date.now());
            this.logger.log(`User ${userId} registered with socket ${client.id}`);
        }

        const timeout = setTimeout(() => {
            this.logger.warn(`Connection timeout for ${client.id}`);
            client.emit('connection_timeout', { message: 'Timeout waiting for joinchat' });
            client.disconnect();
        }, 200000); // 200s timeout

        this.socketTimeouts.set(client.id, timeout);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        const userId = this.socketToUserId.get(client.id);
        
        if (userId) {
            this.connectedUsers.delete(userId);
            this.socketToUserId.delete(client.id);
        }
        
        const timeout = this.socketTimeouts.get(client.id);
        if (timeout) {
            clearTimeout(timeout);
            this.socketTimeouts.delete(client.id);
        }
        this.socketLastActive.delete(client.id);
    }

    @SubscribeMessage('available')
    handleAvailable(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        this.socketLastActive.set(client.id, Date.now());
    }

    @SubscribeMessage('disconnect')
    handleDisconnectEvent(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        client.disconnect();
    }

    @SubscribeMessage('joinchat')
    handleJoinChat(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        const timeout = this.socketTimeouts.get(client.id);
        if (timeout) {
            clearTimeout(timeout);
            this.socketTimeouts.delete(client.id);
        }
        const conversationId = data?.conversationId || data?.data?.conversationId;
        if (conversationId) {
            client.join(`room_${conversationId}`);
        }
    }

    @SubscribeMessage('send')
    async handleSend(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        console.log('--- handleSend called!', data);
        const userId = this.socketToUserId.get(client.id);
        console.log('--- handleSend userId:', userId);
        if (!userId) {
            client.emit('connection_error', { message: 'Not authenticated' });
            return;
        }

        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            console.log('--- handleSend user found:', user?.id);
            if (!user) return;

            const res = await this.conversationsService.setSendMessage(
                user,
                data?.message || data?.data?.message,
                data?.partnerId || data?.data?.partnerId,
                data?.conversationId || data?.data?.conversationId,
            );
            console.log('--- setSendMessage success:', res);
        } catch (error: any) {
            console.error('--- error in handleSend:', error);
            client.emit('connection_error', { message: error.message || 'Cannot send message' });
        }
    }

    @SubscribeMessage('deletemessage')
    async handleDeleteMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        const userId = this.socketToUserId.get(client.id);
        if (!userId) return;
        
        const messageId = data?.messageId || data?.data?.messageId;
        if (!messageId) return;

        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user) return;
            await this.conversationsService.deleteMessage(user, messageId);
        } catch (error: any) {
            client.emit('connection_error', { message: error.message || 'Cannot delete message' });
        }
    }

    @SubscribeMessage('reconnecting')
    handleReconnecting(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        const token = data?.token;
        if (token) {
            this.prisma.user.findFirst({ where: { token } }).then(user => {
                if (!user || user.status === UserStatus.LOCKED) {
                    client.emit('reconnect_attempt');
                } else {
                    this.socketLastActive.set(client.id, Date.now());
                }
            }).catch(() => {
                client.emit('reconnect_attempt');
            });
        }
    }

    public sendToUser(userId: string, event: string, data: any) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.server.to(socketId).emit(event, data);
        } else {
            this.logger.warn(`User ${userId} is not connected, cannot send event ${event}`);
        }
    }

    public sendNewMessage(receiverId: string, messagePayload: any) {
        this.sendToUser(receiverId, 'onmessage', messagePayload);
    }

    public emitDeleteMessage(receiverId: string, payload: any) {
        this.sendToUser(receiverId, 'deletemessage', payload);
    }

    public sendPushNotification(receiverId: string, notificationPayload: any) {
        this.sendToUser(receiverId, 'push_notification', notificationPayload);
    }
}
