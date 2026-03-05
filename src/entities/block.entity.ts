import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity.ts';

@Entity('blocks')
export class Block {
    @PrimaryColumn({ type: 'uuid' })
    blocker_id: string;

    @PrimaryColumn({ type: 'uuid' })
    blocked_id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'blocker_id' })
    blocker: User;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'blocked_id' })
    blocked: User;
}
