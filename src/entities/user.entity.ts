import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { UserRole, UserStatus } from '../common/enums/user.enum.ts';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', unique: true })
    phonenumber: string;

    @Column({ type: 'varchar' })
    password: string;

    @Column({ type: 'varchar', nullable: true })
    username: string | null;

    @Column({ type: 'varchar', nullable: true })
    avatar: string | null;

    @Column({ type: 'varchar', nullable: true })
    cover_image: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({
        type: 'enum',
        enum: UserRole,
    })
    role: UserRole;

    @Column({ type: 'varchar', nullable: true })
    token: string | null;

    @Column({
        type: 'enum',
        enum: UserStatus,
        default: UserStatus.ACTIVE,
    })
    status: UserStatus;

    @Column({ type: 'boolean', default: false })
    online: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;
}
