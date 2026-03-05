import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity.ts';
import { Conversation } from './conversation.entity.ts';

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    conversation_id: string;

    @Column({ type: 'uuid' })
    sender_id: string;

    @Column({ type: 'uuid' })
    receiver_id: string;

    @Column({ type: 'text', nullable: true })
    content: string | null;

    @Column({ type: 'boolean', default: false })
    is_read: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'conversation_id' })
    conversation: Conversation;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sender_id' })
    sender: User;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receiver_id' })
    receiver: User;
}
