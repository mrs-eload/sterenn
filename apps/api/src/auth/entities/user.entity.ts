import { randomUUID } from 'node:crypto';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// `user` is reserved in several databases, hence `app_user`.
@Entity('app_user')
export class User {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  // Google's permanent id for the account. Sign-in matches on this, not on email.
  @Column({ type: 'varchar', length: 255, unique: true })
  google_sub: string;

  // Display only.
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
