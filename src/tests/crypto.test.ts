import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken, generateSecureState } from '../../server/crypto.ts';

test('crypto: AES-256-GCM successfully encrypts and decrypts OAuth tokens', () => {
  const sampleToken = 'EAABwzLIX564BAOD7ZB9ZCHx7...sample_facebook_page_access_token';
  const encrypted = encryptToken(sampleToken);

  assert.ok(encrypted.ciphertext, 'Ciphertext should be non-empty');
  assert.ok(encrypted.iv, 'IV should be non-empty');
  assert.ok(encrypted.tag, 'Auth tag should be non-empty');
  assert.notEqual(encrypted.ciphertext, sampleToken, 'Ciphertext must not equal plaintext');

  const decrypted = decryptToken(encrypted);
  assert.equal(decrypted, sampleToken, 'Decrypted token must exactly match original plaintext');
});

test('crypto: detects tampering with ciphertext or auth tag', () => {
  const sampleToken = 'secret-token-12345';
  const encrypted = encryptToken(sampleToken);

  // Tamper with ciphertext by flipping characters while preserving valid even hex length
  const tamperedCiphertext =
    (encrypted.ciphertext[0] === 'a' ? 'b' : 'a') + encrypted.ciphertext.slice(1);

  assert.throws(
    () => {
      decryptToken({
        ciphertext: tamperedCiphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
      });
    },
    /Unsupported state or unable to authenticate data|bad decrypt/i,
    'Should throw error on tampered ciphertext'
  );

  // Tamper with auth tag by flipping characters while preserving valid even hex length
  const tamperedTag =
    (encrypted.tag[0] === 'a' ? 'b' : 'a') + encrypted.tag.slice(1);
  assert.throws(
    () => {
      decryptToken({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: tamperedTag,
      });
    },
    /Unsupported state or unable to authenticate data|bad decrypt/i,
    'Should throw error on tampered tag'
  );
});

test('crypto: generateSecureState returns cryptographically random hex strings', () => {
  const state1 = generateSecureState();
  const state2 = generateSecureState();

  assert.equal(typeof state1, 'string');
  assert.equal(state1.length, 48); // 24 bytes = 48 hex chars
  assert.notEqual(state1, state2, 'States must be distinct');
});
