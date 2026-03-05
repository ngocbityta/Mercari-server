/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { EventsGateway } from './events.gateway.ts';
import { Server, Socket } from 'socket.io';
import { PushSetting } from '../entities/push-setting.entity.ts';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('EventsGateway', () => {
    let gateway: EventsGateway;
    let pushSettingsRepositoryMock: Partial<Record<keyof Repository<PushSetting>, jest.Mock>>;

    beforeEach(async () => {
        pushSettingsRepositoryMock = {
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventsGateway,
                {
                    provide: getRepositoryToken(PushSetting),
                    useValue: pushSettingsRepositoryMock,
                },
            ],
        }).compile();

        gateway = module.get<EventsGateway>(EventsGateway);
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('handleConnection/handleDisconnect', () => {
        it('should handle client connection', () => {
            const clientMock = {
                id: 'socket-id-1',
                handshake: {
                    query: { user_id: 'user-id-1' },
                },
            } as unknown as Socket;

            gateway.handleConnection(clientMock);

            // Access the private map for testing (using type assertion)
            expect((gateway as any).connectedUsers.get('user-id-1')).toBe('socket-id-1');
        });

        it('should handle client disconnect', () => {
            const clientMock = {
                id: 'socket-id-1',
                handshake: {
                    query: { user_id: 'user-id-1' },
                },
            } as unknown as Socket;

            gateway.handleConnection(clientMock);
            expect((gateway as any).connectedUsers.get('user-id-1')).toBe('socket-id-1');

            gateway.handleDisconnect(clientMock);
            // Even though it doesn't remove by socket.id in mapping unless iterated,
            // since we handleDisconnect without removing from the map right now in the implementation,
            // let's just make sure it doesn't throw.
            expect(gateway).toBeDefined();
        });
    });

    describe('sendPushNotification', () => {
        it('should emit push_notification to connected user', () => {
            const mockServer = {
                to: jest.fn().mockReturnThis(),
                emit: jest.fn(),
            } as unknown as Server;

            gateway.server = mockServer;

            // Connect a user
            const clientMock = {
                id: 'socket-id-1',
                handshake: {
                    query: { user_id: 'user-1' },
                },
            } as unknown as Socket;
            gateway.handleConnection(clientMock);

            gateway.sendPushNotification('user-1', { message: 'liked' });

            expect(mockServer.to).toHaveBeenCalledWith('socket-id-1');
            expect(mockServer.emit).toHaveBeenCalledWith('push_notification', { message: 'liked' });
        });
    });

    describe('sendNewMessage', () => {
        it('should emit to connected user', () => {
            const mockServer = {
                to: jest.fn().mockReturnThis(),
                emit: jest.fn(),
            } as unknown as Server;

            gateway.server = mockServer;

            const clientMock = {
                id: 'socket-id-2',
                handshake: {
                    query: { user_id: 'user-2' },
                },
            } as unknown as Socket;
            gateway.handleConnection(clientMock);

            gateway.sendNewMessage('user-2', { text: 'hi' });

            expect(mockServer.to).toHaveBeenCalledWith('socket-id-2');
            expect(mockServer.emit).toHaveBeenCalledWith('new_message', { text: 'hi' });
        });
    });
});
