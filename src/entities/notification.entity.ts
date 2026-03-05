import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity.ts';

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', nullable: true })
    type: string | null;

    @Column({ type: 'uuid', nullable: true })
    object_id: string | null;

    @Column({ type: 'varchar', nullable: true })
    title: string | null;

    @Column({ type: 'varchar', nullable: true })
    avatar: string | null;

    @Column({ type: 'int', default: 0 })
    group_type: number;

    @Column({ type: 'boolean', default: false })
    is_read: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
