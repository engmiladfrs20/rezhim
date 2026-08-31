/**
 * Runtime-compatible password hashing and verification.
 *
 * Cloudflare Workerd currently rejects a single PBKDF2 Web Crypto operation
 * above 100,000 iterations. We retain the application's 600,000–2,000,000
 * cost policy by chaining bounded PBKDF2 derivations. The algorithm identifier
 * is versioned so the stored representation is never mistaken for a standard
 * single-call PBKDF2 hash.
 */
export class PasswordService {
  static readonly ITERATIONS = 600_000;
  static readonly MIN_ITERATIONS = 600_000;
  static readonly MAX_ITERATIONS = 2_000_000;
  static readonly HASH_ALGORITHM = 'PBKDF2-HMAC-SHA256-CHUNKED-v1';
  private static readonly MAX_RUNTIME_ITERATIONS = 100_000;
  private static readonly KEY_LENGTH_BITS = 256;
  private static readonly SALT_LENGTH_BYTES = 16;

  static async hash(
    password: string,
  ): Promise<{ hash: string; salt: string; iterations: number; algorithm: string }> {
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH_BYTES));
    const token = await this.deriveHash(password, salt, this.ITERATIONS);

    return {
      hash: this.bufferToBase64Url(token),
      salt: this.bufferToBase64Url(salt),
      iterations: this.ITERATIONS,
      algorithm: this.HASH_ALGORITHM,
    };
  }

  static async verify(
    password: string,
    expectedHash: string,
    saltB64: string,
    iterations: number = this.ITERATIONS,
    algorithm: string = this.HASH_ALGORITHM,
  ): Promise<boolean> {
    // 1. Reject unsupported algorithm
    if (algorithm !== this.HASH_ALGORITHM) {
      return false;
    }

    // 2. Reject iteration count out of acceptable bounds
    if (
      typeof iterations !== 'number' ||
      !Number.isInteger(iterations) ||
      iterations < this.MIN_ITERATIONS ||
      iterations > this.MAX_ITERATIONS
    ) {
      return false;
    }

    let saltBuffer: ArrayBuffer;
    let expectedHashBuffer: ArrayBuffer;

    try {
      saltBuffer = this.base64UrlToBuffer(saltB64);
      expectedHashBuffer = this.base64UrlToBuffer(expectedHash);
    } catch {
      return false; // Malformed base64
    }

    // 3. Salt and hash exact length checks
    if (saltBuffer.byteLength !== this.SALT_LENGTH_BYTES) {
      return false;
    }
    if (expectedHashBuffer.byteLength !== this.KEY_LENGTH_BITS / 8) {
      return false;
    }

    const matchToken = await this.deriveHash(password, new Uint8Array(saltBuffer), iterations);

    const a = new Uint8Array(expectedHashBuffer);
    const b = new Uint8Array(matchToken);

    if (a.length !== b.length) {
      return false;
    }

    // Workerd timingSafeEqual support check
    const subtle = crypto.subtle as SubtleCrypto & {
      timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean;
    };
    if (typeof subtle.timingSafeEqual === 'function') {
      try {
        return subtle.timingSafeEqual(a.buffer, b.buffer);
      } catch {
        // Fall back to constant-time bitwise loop
      }
    }

    // Constant-time bitwise equality loop
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      const byteA = a[i] ?? 0;
      const byteB = b[i] ?? 0;
      mismatch |= byteA ^ byteB;
    }
    return mismatch === 0;
  }

  /**
   * Dummy operation to mitigate timing side-channel attacks for unknown emails.
   */
  static async dummyVerify(): Promise<void> {
    const dummySalt = new Uint8Array(this.SALT_LENGTH_BYTES);
    await this.deriveHash('dummypassword234!@#', dummySalt, this.ITERATIONS);
  }

  private static async deriveHash(
    password: string,
    salt: Uint8Array,
    iterations: number,
  ): Promise<ArrayBuffer> {
    let keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    );
    let remaining = iterations;
    let derived: ArrayBuffer | undefined;

    // Keep every individual Web Crypto call within Workerd's 100k limit while
    // preserving the configured total cost. Each subsequent chunk uses the
    // previous chunk as its key material, producing a deterministic KDF chain.
    while (remaining > 0) {
      const chunkIterations = Math.min(remaining, this.MAX_RUNTIME_ITERATIONS);
      derived = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt.buffer as ArrayBuffer,
          iterations: chunkIterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        this.KEY_LENGTH_BITS,
      );
      remaining -= chunkIterations;

      if (remaining > 0) {
        keyMaterial = await crypto.subtle.importKey('raw', derived, { name: 'PBKDF2' }, false, [
          'deriveBits',
        ]);
      }
    }

    // Iteration validation happens before this method is called, so this is
    // unreachable for valid inputs; keeping the guard makes the contract
    // explicit if the private method is changed later.
    if (!derived) {
      throw new Error('Password derivation requires at least one iteration');
    }
    return derived;
  }

  static bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      const b = bytes[i] ?? 0;
      binary += String.fromCharCode(b);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  static base64UrlToBuffer(b64: string): ArrayBuffer {
    let padding = '';
    if (b64.length % 4 !== 0) {
      padding = '='.repeat(4 - (b64.length % 4));
    }
    const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
