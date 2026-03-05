import {
    Entity,
    Column,
    PrimaryColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity.ts';

@Entity('push_settings')
export class PushSetting {
    @PrimaryColumn('uuid')
    user_id: string;

    @Column({ type: 'int', default: 1 })
    like_comment: number;

    @Column({ type: 'int', default: 1 })
    from_friends: number;

    @Column({ type: 'int', default: 1 })
    requested_friend: number;

    @Column({ type: 'int', default: 1 })
    suggested_friend: number;

    @Column({ type: 'int', default: 1 })
    birthday: number;

    @Column({ type: 'int', default: 1 })
    video: number;

    @Column({ type: 'int', default: 1 })
    report: number;

    @Column({ type: 'int', default: 1 })
    sound_on: number;

    @Column({ type: 'int', default: 1 })
    notification_on: number;

    @Column({ type: 'int', default: 1 })
    vibrant_on: number;

    @Column({ type: 'int', default: 1 })
    led_on: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
