import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthProvider, Role, type PublicUser } from '@learn-and-build/types';

@Entity({ name: 'users' })
// A given external identity (provider + subject) maps to exactly one user.
@Index('uq_users_provider_subject', ['provider', 'providerSubject'], {
  unique: true,
  where: '"provider_subject" IS NOT NULL',
})
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  // Null for users who authenticate exclusively via an external OIDC provider.
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'display_name' })
  displayName!: string;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role!: Role;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  provider!: AuthProvider;

  // The "sub" claim from the external provider; null for local accounts.
  @Column({ name: 'provider_subject', type: 'varchar', nullable: true })
  providerSubject!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  toPublic(): PublicUser {
    return {
      id: this.id,
      email: this.email,
      displayName: this.displayName,
      role: this.role,
      provider: this.provider,
      createdAt: this.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
