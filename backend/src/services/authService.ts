import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { BadRequest, Unauthorized } from '../lib/errors.js';
import type { Mailer } from './mailer.js';
import type { User, UserStore } from './userStore.js';

const BCRYPT_COST = 12;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h for invite/reset links

export interface AuthTokenPayload {
  sub: string;
  email: string;
  relationshipId: string;
  role: string;
  brand: string;
}

/** Handles the carrier invite → set-password → login lifecycle. */
export class AuthService {
  constructor(
    private readonly store: UserStore,
    private readonly mailer: Mailer,
  ) {}

  /** Admin action: create (or re-invite) a carrier user and email a setup link. */
  async invite(email: string, relationshipId: string, brand = 'easdial'): Promise<void> {
    const normalized = email.trim().toLowerCase();
    let user = await this.store.findByEmail(normalized);
    if (!user) {
      user = await this.store.create({
        email: normalized,
        relationshipId,
        brand,
        role: 'carrier',
        passwordHash: null,
        status: 'invited',
      });
    }
    await this.issueSetupToken(user, 'invite');
  }

  /** Self-service: request a reset link. Silent on unknown email (no enumeration). */
  async requestReset(email: string): Promise<void> {
    const user = await this.store.findByEmail(email.trim().toLowerCase());
    if (user) await this.issueSetupToken(user, 'reset');
  }

  /** Consume a single-use token and set the password. */
  async setPassword(rawToken: string, newPassword: string): Promise<void> {
    if (newPassword.length < 10) throw BadRequest('Password must be at least 10 characters');
    const tokenHash = this.hashToken(rawToken);

    const invite = await this.store.findValidToken(tokenHash, 'invite');
    const reset = invite ? null : await this.store.findValidToken(tokenHash, 'reset');
    const token = invite ?? reset;
    if (!token) throw BadRequest('Invalid or expired token', 'invalid_token');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.store.update(token.userId, { passwordHash, status: 'active' });
    await this.store.markTokenUsed(token.id);
  }

  /** Verify credentials and mint a JWT. */
  async login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await this.store.findByEmail(email.trim().toLowerCase());
    // Constant-ish work whether or not the user exists / has a password.
    const hash = user?.passwordHash ?? '$2a$12$0000000000000000000000000000000000000000000000000000';
    const ok = await bcrypt.compare(password, hash);
    if (!user || !user.passwordHash || !ok) throw Unauthorized('Invalid email or password');
    if (user.status !== 'active') throw Unauthorized('Account is not active');

    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      relationshipId: user.relationshipId,
      role: user.role,
      brand: user.brand,
    };
    const signOptions = { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions;
    const token = jwt.sign(payload, config.JWT_SECRET, signOptions);
    return { token, user: toPublic(user) };
  }

  verify(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;
    } catch {
      throw Unauthorized('Invalid or expired session');
    }
  }

  // --- helpers -----------------------------------------------------------

  private async issueSetupToken(user: User, purpose: 'invite' | 'reset'): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    await this.store.saveToken({
      userId: user.id,
      tokenHash: this.hashToken(rawToken),
      purpose,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      usedAt: null,
    });
    await this.mailer.sendPasswordSetup(user.email, rawToken, purpose);
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}

export interface PublicUser {
  id: string;
  email: string;
  relationshipId: string;
  brand: string;
  role: string;
}

function toPublic(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    relationshipId: u.relationshipId,
    brand: u.brand,
    role: u.role,
  };
}
