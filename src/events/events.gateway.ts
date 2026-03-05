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

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger: Logger = new Logger('EventsGateway');

    // Map to keep track of user_id to socket_id connections
    private connectedUsers = new Map<string, string>();

    afterInit(_server: Server) {
        this.logger.log('EventsGateway initialized');
    }

    handleConnection(client: Socket, ..._args: any[]) {
        this.logger.log(`Client connected: ${client.id}`);

        // Optional: Extract user token/ID from query/headers to register them
        const userId = client.handshake.query.user_id as string;
        if (userId) {
            this.connectedUsers.set(userId, client.id);
            this.logger.log(`User ${userId} registered with socket ${client.id}`);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        // Remove from connected users map
        for (const [userId, socketId] of this.connectedUsers.entries()) {
            if (socketId === client.id) {
                this.connectedUsers.delete(userId);
                this.logger.log(`User ${userId} unregistered`);
                break;
            }
        }
    }

    @SubscribeMessage('ping')
    handlePing(@MessageBody() data: any, @ConnectedSocket() client: Socket): string {
        this.logger.log(`Ping received from ${client.id}:`, data);
        return 'pong';
    }

    // --- Helper methods to emit events to specific users ---

    public sendToUser(userId: string, event: string, data: any) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.server.to(socketId).emit(event, data);
        } else {
            this.logger.warn(`User ${userId} is not connected, cannot send event ${event}`);
        }
    }

    public sendNewMessage(receiverId: string, messagePayload: any) {
        this.sendToUser(receiverId, 'new_message', messagePayload);
    }

    public sendPushNotification(receiverId: string, notificationPayload: any) {
        this.sendToUser(receiverId, 'push_notification', notificationPayload);
    }
}
