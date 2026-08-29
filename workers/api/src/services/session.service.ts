import { PasswordService } from './password.service';

export class SessionService {
  private static readonly TOKEN_LENGTH_BYTES = 32;

  /**
   * Generates a cryptographically random 32-byte opaque session token encoded as Base64URL.
   */
  static generateSessionToken(): string {
    const rawBuffer = crypto.getRandomValues(new Uint8Array(this.TOKEN_LENGTH_BYTES));
    return PasswordService.bufferToBase64Url(rawBuffer);
  }

  /**
   * Hashes the raw Base64URL token using SHA-256 and returns the Base64URL-encoded digest.
   */
  static async hashSessionToken(rawToken: string): Promise<string> {
    const data = new TextEncoder().encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return PasswordService.bufferToBase64Url(hashBuffer);
  }
}
