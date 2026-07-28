import { randomUUID } from 'node:crypto';

export type UserStatus = 'invited' | 'active' | 'disabled';
export type UserRole = 'carrier' | 'admin';

export interface User {
  id: string;
  email: string;
  relationshipId: string;
  brand: string;
  role: UserRole;
  passwordHash: string | null;
  status: UserStatus;
}

export interface StoredToken {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: 'invite' | 'reset';
  expiresAt: number; // epoch ms
  usedAt: number | null;
}

/**
 * Persistence seam for users + auth tokens. Phase 1 ships an in-memory
 * implementation so the portal runs with no database; a PgUserStore backed by
 * db/migrations/001_init.sql is the Phase 2 drop-in (same interface).
 */
export interface UserStore {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: Omit<User, 'id'>): Promise<User>;
  update(id: string, patch: Partial<User>): Promise<User>;
  saveToken(token: Omit<StoredToken, 'id'>): Promise<StoredToken>;
  findValidToken(tokenHash: string, purpose: StoredToken['purpose']): Promise<StoredToken | null>;
  markTokenUsed(id: string): Promise<void>;
}

export class InMemoryUserStore implements UserStore {
  private users = new Map<string, User>();
  private tokens = new Map<string, StoredToken>();

  async findByEmail(email: string): Promise<User | null> {
    const key = email.toLowerCase();
    for (const u of this.users.values()) if (u.email.toLowerCase() === key) return u;
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async create(input: Omit<User, 'id'>): Promise<User> {
    const user: User = { id: randomUUID(), ...input };
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, patch: Partial<User>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error(`user ${id} not found`);
    const updated = { ...existing, ...patch, id };
    this.users.set(id, updated);
    return updated;
  }

  async saveToken(token: Omit<StoredToken, 'id'>): Promise<StoredToken> {
    const saved: StoredToken = { id: randomUUID(), ...token };
    this.tokens.set(saved.id, saved);
    return saved;
  }

  async findValidToken(
    tokenHash: string,
    purpose: StoredToken['purpose'],
  ): Promise<StoredToken | null> {
    for (const t of this.tokens.values()) {
      if (
        t.tokenHash === tokenHash &&
        t.purpose === purpose &&
        t.usedAt === null &&
        t.expiresAt > Date.now()
      ) {
        return t;
      }
    }
    return null;
  }

  async markTokenUsed(id: string): Promise<void> {
    const t = this.tokens.get(id);
    if (t) t.usedAt = Date.now();
  }
}
