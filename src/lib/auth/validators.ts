/**
 * 用户名和密码验证规则
 */

const USERNAME_REGEX = /^[A-Za-z0-9]{6,}$/;
const MIN_PASSWORD_LENGTH = 6;

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/** 验证用户名：仅字母+数字，至少 6 位 */
export function validateUsername(username: string): ValidationResult {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: '用户名不能为空' };
    }
    const trimmed = username.trim();
    if (trimmed.length < 6) {
        return { valid: false, error: '用户名至少 6 个字符' };
    }
    if (!USERNAME_REGEX.test(trimmed)) {
        return { valid: false, error: '用户名仅允许字母和数字' };
    }
    return { valid: true };
}

/** 验证密码：至少 6 位 */
export function validatePassword(password: string): ValidationResult {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: '密码不能为空' };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        return { valid: false, error: `密码至少 ${MIN_PASSWORD_LENGTH} 个字符` };
    }
    return { valid: true };
}
