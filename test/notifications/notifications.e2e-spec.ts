/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module.ts';
import { PrismaService } from '../../src/prisma/prisma.service.ts';
import { UserStatus, UserRole } from '../../src/enums/users.enum.ts';
import { ResponseCode } from '../../src/enums/response-code.enum.ts';
import { randomUUID } from 'node:crypto';

describe('NotificationsController (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    const validUserToken = 'valid-token-123';
    const lockedUserToken = 'locked-token-456';
    let validUserId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe());
        await app.init();

        prisma = app.get<PrismaService>(PrismaService);

        // Cleanup and Seed
        await prisma.notification.deleteMany();
        await prisma.user.deleteMany({
            where: {
                OR: [{ token: validUserToken }, { token: lockedUserToken }],
            },
        });

        const user = await prisma.user.create({
            data: {
                phonenumber: '0000000001',
                password: 'hash',
                username: 'valid_user',
                role: UserRole.HV,
                token: validUserToken,
                status: UserStatus.ACTIVE,
            },
        });
        validUserId = user.id;

        await prisma.user.create({
            data: {
                phonenumber: '0000000002',
                password: 'hash',
                username: 'locked_user',
                role: UserRole.HV,
                token: lockedUserToken,
                status: UserStatus.LOCKED,
            },
        });

        // Seed Notifications for valid user
        await prisma.notification.createMany({
            data: [
                {
                    userId: validUserId,
                    title: 'Valid Notification',
                    type: 'message',
                    objectId: randomUUID(),
                    isRead: false,
                },
                {
                    userId: validUserId,
                    title: '', // Should be filtered out (Req 6)
                    type: 'message',
                },
                {
                    userId: validUserId,
                    title: 'Notification with missing fields', // Should have defaults (Req 8)
                    type: null,
                    avatar: null,
                    objectId: null,
                },
            ],
        });
    });

    afterAll(async () => {
        await app.close();
    });

    describe('POST /get_notification', () => {
        it('Scenario 1: Valid token and parameters -> 1000 OK', async () => {
            const response = await supertest(app.getHttpServer()).post('/get_notification').send({
                token: validUserToken,
                index: '0',
                count: '10',
            });

            expect(response.status).toBe(200);
            expect(response.body.code).toBe(ResponseCode.OK);
            expect(response.body.data.data).toBeDefined();
            expect(Array.isArray(response.body.data.data)).toBe(true);
        });

        it('Scenario 2: Invalid token -> 9998', async () => {
            const response = await supertest(app.getHttpServer()).post('/get_notification').send({
                token: 'invalid-token',
                index: '0',
                count: '10',
            });

            expect(response.status).toBe(401);
            expect(response.body.code).toBe(ResponseCode.TOKEN_INVALID);
        });

        it('Scenario 4: Locked account -> 9991', async () => {
            const response = await supertest(app.getHttpServer()).post('/get_notification').send({
                token: lockedUserToken,
                index: '0',
                count: '10',
            });

            expect(response.status).toBe(401);
            expect(response.body.code).toBe(ResponseCode.ACCOUNT_LOCKED);
        });

        it('Scenario 6 & 8: Data filtering and default values', async () => {
            const response = await supertest(app.getHttpServer()).post('/get_notification').send({
                token: validUserToken,
                index: '0',
                count: '10',
            });

            const notifications = response.body.data.data;

            // Check filtering (Req 6) - The one with empty title should be gone
            // Only 2 of the 3 seeded notifications should remain
            expect(notifications.length).toBe(2);

            // Check defaults (Req 8)
            const defaultNotif = notifications.find(
                (n) => n.title === 'Notification with missing fields',
            );
            expect(defaultNotif).toBeDefined();
            expect(defaultNotif.type).toBe('home');
            expect(defaultNotif.avatar).toBe('app_icon');
            expect(defaultNotif.object_id).toBe('0');
        });

        it('Scenario 9 & 10: Badge handling', async () => {
            const response = await supertest(app.getHttpServer()).post('/get_notification').send({
                token: validUserToken,
                index: '0',
                count: '10',
            });

            expect(response.body.data.badge).toBeDefined();
            expect(typeof response.body.data.badge).toBe('string');
            expect(parseInt(response.body.data.badge)).toBeGreaterThanOrEqual(0);
            expect(response.body.data.last_update).toBeDefined(); // Req 5 placeholder check
        });

        it('Scenario 12: Valid JSON structure', async () => {
            const response = await supertest(app.getHttpServer()).post('/get_notification').send({
                token: validUserToken,
                index: '0',
                count: '10',
            });

            expect(typeof response.body).toBe('object');
            expect(response.body.code).toBe(ResponseCode.OK);
        });
    });

    describe('POST /set_read_notification', () => {
        let testNotificationId: string;

        beforeAll(async () => {
            const notif = await prisma.notification.create({
                data: {
                    userId: validUserId,
                    title: 'Read Test',
                    isRead: false,
                },
            });
            testNotificationId = notif.id;
        });

        it('Scenario 1: Valid token and notificationId -> 1000 OK', async () => {
            const response = await supertest(app.getHttpServer())
                .post('/set_read_notification')
                .send({
                    token: validUserToken,
                    notificationId: testNotificationId,
                });

            expect(response.status).toBe(200);
            expect(response.body.code).toBe(ResponseCode.OK);
            expect(response.body.data.badge).toBeDefined();
            expect(response.body.data.last_update).toBeDefined();
        });

        it('Scenario 2: Invalid token -> 9998', async () => {
            const response = await supertest(app.getHttpServer())
                .post('/set_read_notification')
                .send({
                    token: 'invalid-token',
                    notificationId: testNotificationId,
                });

            expect(response.status).toBe(401);
            expect(response.body.code).toBe(ResponseCode.TOKEN_INVALID);
        });

        it('Scenario 4: Locked account -> 9991', async () => {
            const response = await supertest(app.getHttpServer())
                .post('/set_read_notification')
                .send({
                    token: lockedUserToken,
                    notificationId: testNotificationId,
                });

            expect(response.status).toBe(401);
            expect(response.body.code).toBe(ResponseCode.ACCOUNT_LOCKED);
        });

        it('Scenario 7: Already marked as read -> Still 1000 OK', async () => {
            // First mark it read (already done in Scenario 1)
            const response = await supertest(app.getHttpServer())
                .post('/set_read_notification')
                .send({
                    token: validUserToken,
                    notificationId: testNotificationId,
                });

            expect(response.body.code).toBe(ResponseCode.OK);
            expect(response.body.data.badge).toBeDefined();
        });

        it('Should verify badge is returned as string and last_update exists', async () => {
            const response = await supertest(app.getHttpServer())
                .post('/set_read_notification')
                .send({
                    token: validUserToken,
                    notificationId: testNotificationId,
                });

            expect(typeof response.body.data.badge).toBe('string');
            expect(response.body.data.last_update).toBeTruthy();
        });
    });
});
