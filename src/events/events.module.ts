import { forwardRef } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { Module, Global } from '@nestjs/common';
import { EventsGateway } from './events.gateway.ts';

@Global()
@Module({
    imports: [forwardRef(() => ConversationsModule)],
    providers: [EventsGateway],
    exports: [EventsGateway],
})
export class EventsModule {}
