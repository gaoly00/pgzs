/**
 * 密码哈希与验证 — bcryptjs
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/** 对明文密码进行哈希 */
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

/** 验证明文密码是否匹配哈希 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}
