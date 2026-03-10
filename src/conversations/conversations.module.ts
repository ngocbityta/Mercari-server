import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller.ts';
import { ConversationsService } from './conversations.service.ts';

@Module({
    controllers: [ConversationsController],
    providers: [ConversationsService],
    exports: [ConversationsService],
})
export class ConversationsModule {}
