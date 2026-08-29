import { PasswordService } from './password.service';

export class SessionService {
  private static readonly TOKEN_LENGTH_BYTES = 32;

  /**
   * Generates a raw opaque cryptographically secure 32-byte token Native to WebCrypto.
   * Returns identical encoded variants tracking native generation limits securely.
   */
  static generateSessionToken(): string {
    const rawBuffer = crypto.getRandomValues(new Uint8Array(this.TOKEN_LENGTH_BYTES));
    return PasswordService.bufferToBase64Url(rawBuffer);
  }

  /**
   * Hashes the raw Base64Url token using SHA-256 preventing DB leakage native behaviors tracking correctly.
   */
  static async hashSessionToken(rawToken: string): Promise<string> {
    const data = new TextEncoder().encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return PasswordService.bufferToBase64Url(hashBuffer);
  }
}
