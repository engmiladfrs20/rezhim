import { describe, expect, it } from 'vitest';
import { PasswordService } from '../src/services/password.service';

describe('PasswordService Cryptography Bounds', () => {
  it('verifies valid credentials securely', async () => {
    const { hash, salt, iterations, algorithm } = await PasswordService.hash('MyS3cr3tPas$!');
    const match = await PasswordService.verify('MyS3cr3tPas$!', hash, salt, iterations, algorithm);
    expect(match).toBe(true);
  }, 20000);

  it('rejects incorrect passwords', async () => {
    const { hash, salt, iterations, algorithm } = await PasswordService.hash('MyS3cr3tPas$!');
    const match = await PasswordService.verify('WrongPassword', hash, salt, iterations, algorithm);
    expect(match).toBe(false);
  }, 20000);

  it('rejects empty credentials', async () => {
    const { hash, salt, iterations, algorithm } = await PasswordService.hash('Password');
    const match = await PasswordService.verify('', hash, salt, iterations, algorithm);
    expect(match).toBe(false);
  }, 20000);

  it('rejects truncated / malformed base64 without exceptions', async () => {
    const { hash, salt, iterations, algorithm } = await PasswordService.hash('Password');
    const match1 = await PasswordService.verify(
      'Password',
      'invalid-base-@@@',
      salt,
      iterations,
      algorithm,
    );
    expect(match1).toBe(false);

    const match2 = await PasswordService.verify(
      'Password',
      hash,
      'invalid-@@@',
      iterations,
      algorithm,
    );
    expect(match2).toBe(false);
  }, 20000);

  it('rejects unsupported hash algorithms', async () => {
    const { hash, salt, iterations } = await PasswordService.hash('Password');
    const match = await PasswordService.verify('Password', hash, salt, iterations, 'MD5');
    expect(match).toBe(false);
  }, 20000);

  it('rejects invalid-salt / invalid length salts', async () => {
    const { hash, iterations, algorithm } = await PasswordService.hash('Password');
    const shortSaltBuffer = new Uint8Array(8); // 8 bytes instead of 16
    const shortSaltB64 = PasswordService.bufferToBase64Url(shortSaltBuffer);
    const match = await PasswordService.verify(
      'Password',
      hash,
      shortSaltB64,
      iterations,
      algorithm,
    );
    expect(match).toBe(false);
  }, 20000);

  it('rejects invalid-iteration boundaries (below minimum or above maximum)', async () => {
    const { hash, salt, algorithm } = await PasswordService.hash('Password');
    const matchUnder = await PasswordService.verify('Password', hash, salt, 100, algorithm);
    expect(matchUnder).toBe(false);

    const matchOver = await PasswordService.verify('Password', hash, salt, 5_000_000, algorithm);
    expect(matchOver).toBe(false);

    const matchCorrupt = await PasswordService.verify(
      'Password',
      hash,
      salt,
      1_000_000_000,
      algorithm,
    );
    expect(matchCorrupt).toBe(false);
  }, 20000);

  it('executes dummyVerify without throwing', async () => {
    await expect(PasswordService.dummyVerify()).resolves.toBeUndefined();
  }, 20000);
});
