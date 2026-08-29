import type { D1Database } from '@cloudflare/workers-types';
import type { RegisterDto, LoginDto } from '@nutriai/schemas';
import type { PublicUser } from '@nutriai/types';
import type { UserRecord, AuthSessionRecord } from '../db/models';
import { toPublicUser } from './auth.mapper';
import { UserRepository } from '../db/user.repository';
import { SessionRepository } from '../db/session.repository';
import { LoginAttemptRepository } from '../db/login-attempt.repository';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;
  private loginAttemptRepo: LoginAttemptRepository;

  constructor(db?: D1Database | undefined) {
    this.userRepo = new UserRepository(db);
    this.sessionRepo = new SessionRepository(db);
    this.loginAttemptRepo = new LoginAttemptRepository(db);
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async register(data: RegisterDto): Promise<PublicUser> {
    const normalized = AuthService.normalizeEmail(data.email);

    const { hash, salt, iterations, algorithm } = await PasswordService.hash(data.password);

    // Explicitly safe mapping avoiding injected external payloads
    const newUser: UserRecord = {
      id: crypto.randomUUID(),
      email: data.email.trim(),
      email_normalized: normalized,
      password_hash: hash,
      password_salt: salt,
      password_iterations: iterations,
      password_algorithm: algorithm,
      display_name: data.display_name.trim(),
      role: 'user', // strictly enforced dynamically.
      status: 'active',
      locale: 'fa',
      email_verified_at: null,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await this.userRepo.createUser(newUser);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
        throw new AppError('EMAIL_ALREADY_EXISTS', 'Email currently exists or is invalid');
      }
      throw err;
    }

    return toPublicUser(newUser);
  }

  async login(
    data: LoginDto,
    requestIpStr: string,
    hmacSecret: string,
  ): Promise<{ rawToken: string; user: PublicUser }> {
    const normalized = AuthService.normalizeEmail(data.email);
    const encoder = new TextEncoder();

    const hmacKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(hmacSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const ipHashBuffer = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(requestIpStr));
    const ipHash = PasswordService.bufferToBase64Url(ipHashBuffer);

    const emailHashBuffer = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(normalized));
    const emailHash = PasswordService.bufferToBase64Url(emailHashBuffer);

    // Rate Limiting evaluates bounds tracking gracefully: 5 attempts per 15 minutes mapped window
    const limitWindowIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const startAttemptIso = new Date().toISOString();

    const attempts = await this.loginAttemptRepo.recordAttempt(
      emailHash,
      ipHash,
      limitWindowIso,
      startAttemptIso,
    );

    if (attempts > 5) {
      throw new AppError('RATE_LIMITED', 'Too many attempts. Please try again later.');
    }

    const user = await this.userRepo.findByNormalizedEmail(normalized);

    // Secure Timing dummy blocks matching missing bounds
    if (!user || user.status !== 'active') {
      await PasswordService.dummyVerify();
      throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    const valid = await PasswordService.verify(
      data.password,
      user.password_hash,
      user.password_salt,
      user.password_iterations,
      user.password_algorithm,
    );

    if (!valid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    await this.loginAttemptRepo.clearAttempts(emailHash, ipHash);

    const nowIso = new Date().toISOString();
    await this.userRepo.recordLogin(user.id, nowIso);

    const rawToken = SessionService.generateSessionToken();
    const tokenHash = await SessionService.hashSessionToken(rawToken);

    const expIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 Days

    const newSession: AuthSessionRecord = {
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: tokenHash,
      created_at: nowIso,
      last_seen_at: nowIso,
      expires_at: expIso,
      revoked_at: null,
    };

    await this.sessionRepo.createSession(newSession);

    return { rawToken, user: toPublicUser(user) };
  }

  async validateAndTouchToken(
    rawToken: string,
  ): Promise<{ session: AuthSessionRecord; user: UserRecord } | null> {
    const tokenHash = await SessionService.hashSessionToken(rawToken);
    const session = await this.sessionRepo.findByRawHash(tokenHash);

    if (!session || session.revoked_at) return null;
    if (new Date(session.expires_at) < new Date()) return null;

    const user = await this.userRepo.findById(session.user_id);
    if (!user || user.status !== 'active') return null;

    const touchRangeMs = 15 * 60 * 1000;
    const nowTs = Date.now();
    if (nowTs - new Date(session.last_seen_at).getTime() > touchRangeMs) {
      await this.sessionRepo.updateLastSeen(session.id, new Date(nowTs).toISOString());
    }

    return { session, user };
  }
}
