/**
 * 统一 HMAC 签名工具
 *
 * 提供 Node.js 和 Edge Runtime 两种环境的 HMAC-SHA256 实现。
 * 用于 session cookie 的签名和验证。
 */

/**
 * 获取会话签名密钥
 * 必须通过 SESSION_SECRET 环境变量设置
 */
export function getSessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET 环境变量未设置');
    return secret;
}

/**
 * Node.js 环境：使用 crypto 模块进行 HMAC-SHA256 签名
 */
export function hmacSignNode(data: string, secret: string): string {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Edge Runtime 环境：使用 Web Crypto API 进行 HMAC-SHA256 签名
 */
export async function hmacSignEdge(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return bufferToHex(sig);
}

/**
 * 将 ArrayBuffer 转为 hex 字符串
 */
function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * 将 hex 字符串转为 Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

/**
 * 时间安全的字符串比较（防止时序攻击）
 * Node.js 环境
 */
export function timingSafeEqualNode(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const crypto = require('crypto');
    try {
        const aBuf = Buffer.from(a, 'hex');
        const bBuf = Buffer.from(b, 'hex');
        if (aBuf.length !== bBuf.length) return false;
        return crypto.timingSafeEqual(aBuf, bBuf);
    } catch {
        return false;
    }
}

/**
 * 时间安全的字符串比较（防止时序攻击）
 * Edge Runtime 环境
 */
export function timingSafeEqualEdge(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const aBuf = hexToBytes(a);
    const bBuf = hexToBytes(b);
    if (aBuf.length !== bBuf.length) return false;
    let result = 0;
    for (let i = 0; i < aBuf.length; i++) {
        result |= aBuf[i] ^ bBuf[i];
    }
    return result === 0;
}
