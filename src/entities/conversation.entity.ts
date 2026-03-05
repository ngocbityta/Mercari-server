import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
    OneToMany,
} from 'typeorm';
import { User } from './user.entity.ts';
import { Message } from './message.entity.ts';

@Entity('conversations')
@Unique(['partner_a_id', 'partner_b_id'])
export class Conversation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    partner_a_id: string;

    @Column({ type: 'uuid' })
    partner_b_id: string;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'partner_a_id' })
    partner_a: User;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'partner_b_id' })
    partner_b: User;

    @OneToMany(() => Message, (message) => message.conversation)
    messages: Message[];
}
