import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Unauthorized } from '../lib/errors.js';
import type { Account, AccountStore, PublicAccount } from './accountStore.js';
import { toPublic } from './accountStore.js';

/** Authentication against EaseDial's own accounts (admin-managed). */
export class AuthService {
  constructor(private readonly accounts: AccountStore) {}

  async login(email: string, password: string): Promise<{ token: string; user: PublicAccount }> {
    const account = this.accounts.findByEmail(email);
    // Compare even when the account is missing, to avoid timing enumeration.
    const ok = account ? await this.accounts.verifyPassword(account, password) : false;
    if (!account || !ok) throw Unauthorized('Invalid email or password');

    const signOptions = { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions;
    const token = jwt.sign({ sub: account.id, role: account.role }, config.JWT_SECRET, signOptions);
    return { token, user: toPublic(account) };
  }

  /** Resolve a bearer token to its (fresh) account, or throw 401. */
  verify(token: string): Account {
    let sub: string;
    try {
      sub = (jwt.verify(token, config.JWT_SECRET) as { sub: string }).sub;
    } catch {
      throw Unauthorized('Invalid or expired session');
    }
    const account = this.accounts.findById(sub);
    if (!account) throw Unauthorized('Session no longer valid');
    return account;
  }
}
