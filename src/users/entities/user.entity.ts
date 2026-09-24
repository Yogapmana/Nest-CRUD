import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  refreshTokenHash: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  passwordResetTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  passwordResetExpiresAt: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
