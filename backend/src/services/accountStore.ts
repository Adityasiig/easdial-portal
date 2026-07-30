import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export type Role = 'admin' | 'user';

export interface Account {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  /** For role=user: the single allocated relationship. */
  relationshipId: string | null;
  relationshipName: string | null;
  createdAt: number;
}

/** Public shape (no password hash). */
export interface PublicAccount {
  id: string;
  email: string;
  role: Role;
  relationshipId: string | null;
  relationshipName: string | null;
}

const BCRYPT_COST = 12;

/**
 * In-memory account store. Seeds one admin from env so the portal is usable on
 * first boot. NOTE: users created at runtime are lost on restart — swap this for
 * the Postgres-backed store (schema in db/migrations) for persistence.
 */
export class AccountStore {
  private byId = new Map<string, Account>();

  async init(): Promise<void> {
    if ([...this.byId.values()].some((a) => a.role === 'admin')) return;
    await this.create({
      email: config.EASDIAL_ADMIN_EMAIL,
      password: config.EASDIAL_ADMIN_PASSWORD,
      role: 'admin',
      relationshipId: null,
      relationshipName: null,
    });
    logger.info(`Seeded admin account: ${config.EASDIAL_ADMIN_EMAIL}`);
    if (config.isProd && config.EASDIAL_ADMIN_PASSWORD === 'changeme_admin_password') {
      logger.warn('EASDIAL_ADMIN_PASSWORD is the DEFAULT in production — set a real one.');
    }
  }

  list(): PublicAccount[] {
    return [...this.byId.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(toPublic);
  }

  findByEmail(email: string): Account | null {
    const key = email.trim().toLowerCase();
    for (const a of this.byId.values()) if (a.email === key) return a;
    return null;
  }

  findById(id: string): Account | null {
    return this.byId.get(id) ?? null;
  }

  async create(input: {
    email: string;
    password: string;
    role: Role;
    relationshipId: string | null;
    relationshipName: string | null;
  }): Promise<PublicAccount> {
    const email = input.email.trim().toLowerCase();
    if (this.findByEmail(email)) throw new Error('email_exists');
    const account: Account = {
      id: randomUUID(),
      email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
      role: input.role,
      relationshipId: input.relationshipId,
      relationshipName: input.relationshipName,
      createdAt: Date.now(),
    };
    this.byId.set(account.id, account);
    return toPublic(account);
  }

  async update(
    id: string,
    patch: { password?: string; relationshipId?: string | null; relationshipName?: string | null },
  ): Promise<PublicAccount> {
    const account = this.byId.get(id);
    if (!account) throw new Error('not_found');
    if (patch.password) account.passwordHash = await bcrypt.hash(patch.password, BCRYPT_COST);
    if (patch.relationshipId !== undefined) account.relationshipId = patch.relationshipId;
    if (patch.relationshipName !== undefined) account.relationshipName = patch.relationshipName;
    return toPublic(account);
  }

  delete(id: string): void {
    this.byId.delete(id);
  }

  async verifyPassword(account: Account, password: string): Promise<boolean> {
    return bcrypt.compare(password, account.passwordHash);
  }
}

export function toPublic(a: Account): PublicAccount {
  return {
    id: a.id,
    email: a.email,
    role: a.role,
    relationshipId: a.relationshipId,
    relationshipName: a.relationshipName,
  };
}
