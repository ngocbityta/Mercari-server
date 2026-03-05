import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsController } from './conversations.controller.ts';
import { ConversationsService } from './conversations.service.ts';
import { Conversation } from '../entities/conversation.entity.ts';
import { Message } from '../entities/message.entity.ts';
import { User } from '../entities/user.entity.ts';
import { Block } from '../entities/block.entity.ts';

@Module({
    imports: [TypeOrmModule.forFeature([Conversation, Message, User, Block])],
    controllers: [ConversationsController],
    providers: [ConversationsService],
    exports: [ConversationsService],
})
export class ConversationsModule {}
