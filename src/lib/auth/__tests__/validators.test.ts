import { describe, it, expect, beforeEach } from 'vitest';
import { validateUsername, validatePassword } from '../validators';

describe('Auth Validators', () => {
  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(validateUsername('user123').valid).toBe(true);
      expect(validateUsername('admin123').valid).toBe(true);
      expect(validateUsername('testuser').valid).toBe(true);
      expect(validateUsername('username').valid).toBe(true);
    });

    it('should reject usernames that are too short', () => {
      expect(validateUsername('ab').valid).toBe(false);
      expect(validateUsername('a').valid).toBe(false);
      expect(validateUsername('user1').valid).toBe(false);
    });

    it('should reject usernames with invalid characters', () => {
      expect(validateUsername('user@name').valid).toBe(false);
      expect(validateUsername('user name').valid).toBe(false);
      expect(validateUsername('user#123').valid).toBe(false);
      expect(validateUsername('test_user').valid).toBe(false);
      expect(validateUsername('user-name').valid).toBe(false);
    });

    it('should reject empty or whitespace usernames', () => {
      expect(validateUsername('').valid).toBe(false);
      expect(validateUsername('   ').valid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(validatePassword('Password123').valid).toBe(true);
      expect(validatePassword('MyP@ssw0rd').valid).toBe(true);
      expect(validatePassword('Secure123!').valid).toBe(true);
      expect(validatePassword('simple').valid).toBe(true); // 6+ chars is valid
    });

    it('should reject passwords that are too short', () => {
      expect(validatePassword('Pass1').valid).toBe(false);
      expect(validatePassword('Abc12').valid).toBe(false);
      expect(validatePassword('12345').valid).toBe(false);
    });

    it('should reject empty passwords', () => {
      expect(validatePassword('').valid).toBe(false);
    });
  });
});
