import { describe, it, expect } from 'vitest';
import { getSessionSecret, hmacSignNode, timingSafeEqualNode } from '../hmac';

describe('HMAC Utilities', () => {
  describe('getSessionSecret', () => {
    it('should return the session secret from environment', () => {
      const secret = getSessionSecret();
      expect(secret).toBeDefined();
      expect(secret).toBe('test-secret-key-for-vitest-testing');
    });
  });

  describe('hmacSignNode', () => {
    it('should generate HMAC signature', () => {
      const data = 'test-data';
      const secret = 'test-secret';
      const signature = hmacSignNode(data, secret);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64); // SHA-256 hex = 64 chars
      expect(signature).toMatch(/^[0-9a-f]+$/); // hex format
    });

    it('should generate consistent signatures for same input', () => {
      const data = 'test-data';
      const secret = 'test-secret';
      const sig1 = hmacSignNode(data, secret);
      const sig2 = hmacSignNode(data, secret);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different data', () => {
      const secret = 'test-secret';
      const sig1 = hmacSignNode('data1', secret);
      const sig2 = hmacSignNode('data2', secret);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const data = 'test-data';
      const sig1 = hmacSignNode(data, 'secret1');
      const sig2 = hmacSignNode(data, 'secret2');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('timingSafeEqualNode', () => {
    it('should return true for identical strings', () => {
      const str = 'abcdef1234567890';
      expect(timingSafeEqualNode(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(timingSafeEqualNode('abc123', 'def456')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(timingSafeEqualNode('abc', 'abcdef')).toBe(false);
    });

    it('should handle hex strings correctly', () => {
      const hex1 = 'a1b2c3d4';
      const hex2 = 'a1b2c3d4';
      const hex3 = 'a1b2c3d5';

      expect(timingSafeEqualNode(hex1, hex2)).toBe(true);
      expect(timingSafeEqualNode(hex1, hex3)).toBe(false);
    });
  });
});
