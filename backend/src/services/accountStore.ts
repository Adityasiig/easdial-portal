import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Pool, type QueryResultRow } from 'pg';
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

interface AccountRow extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  relationship_id: string | null;
  relationship_name: string | null;
  created_at: Date;
}

const BCRYPT_COST = 12;

/**
 * Account store with a synchronous in-process cache and optional Postgres
 * write-through persistence. Keeping reads synchronous avoids putting database
 * access in every JWT verification while DATABASE_URL makes accounts durable.
 */
export class AccountStore {
  private byId = new Map<string, Account>();
  private pool: Pool | null = null;

  async init(): Promise<void> {
    if (config.DATABASE_URL) {
      this.pool = new Pool({ connectionString: config.DATABASE_URL });
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS portal_accounts (
          id UUID PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
          relationship_id TEXT,
          relationship_name TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      const result = await this.pool.query<AccountRow>(`
        SELECT id, email, password_hash, role, relationship_id, relationship_name, created_at
        FROM portal_accounts
        ORDER BY created_at ASC
      `);
      for (const row of result.rows) {
        const account: Account = {
          id: row.id,
          email: row.email,
          passwordHash: row.password_hash,
          role: row.role,
          relationshipId: row.relationship_id,
          relationshipName: row.relationship_name,
          createdAt: row.created_at.getTime(),
        };
        this.byId.set(account.id, account);
      }
      logger.info({ count: result.rowCount ?? 0 }, 'Loaded portal accounts from Postgres');
    } else if (config.isProd) {
      throw new Error('DATABASE_URL is required in production so portal accounts are not lost on restart');
    }

    if ([...this.byId.values()].some((account) => account.role === 'admin')) return;
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
    for (const account of this.byId.values()) if (account.email === key) return account;
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

    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO portal_accounts
            (id, email, password_hash, role, relationship_id, relationship_name, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [
            account.id,
            account.email,
            account.passwordHash,
            account.role,
            account.relationshipId,
            account.relationshipName,
            new Date(account.createdAt),
          ],
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error('email_exists');
        throw error;
      }
    }

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
    if (this.pool) {
      await this.pool.query(
        `UPDATE portal_accounts
         SET password_hash = $2, relationship_id = $3, relationship_name = $4, updated_at = now()
         WHERE id = $1`,
        [account.id, account.passwordHash, account.relationshipId, account.relationshipName],
      );
    }
    return toPublic(account);
  }

  async delete(id: string): Promise<boolean> {
    const account = this.byId.get(id);
    if (!account) return false;
    if (account.role === 'admin') throw new Error('admin_delete_forbidden');
    if (this.pool) await this.pool.query('DELETE FROM portal_accounts WHERE id = $1', [id]);
    return this.byId.delete(id);
  }

  async verifyPassword(account: Account, password: string): Promise<boolean> {
    return bcrypt.compare(password, account.passwordHash);
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export function toPublic(account: Account): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    relationshipId: account.relationshipId,
    relationshipName: account.relationshipName,
  };
}
