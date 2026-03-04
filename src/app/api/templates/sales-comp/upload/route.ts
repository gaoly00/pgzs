import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { withAuth } from '@/lib/auth/with-auth';

// 母板模板存储路径
const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');
const TEMPLATE_FILENAME = 'sales_comp_template.xlsx';

/**
 * POST /api/templates/sales-comp/upload
 * 上传比较法母板模板 (.xlsx)
 * 需要 admin 或 manager 角色
 */
export const POST = withAuth(async (request: NextRequest) => {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
        return NextResponse.json(
            { ok: false, error: '未提供文件，请选择 .xlsx 文件上传' },
            { status: 400 }
        );
    }

    // 验证文件扩展名
    const ext = path.extname(file.name).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xlsm') {
        return NextResponse.json(
            { ok: false, error: `不支持的文件格式: ${ext}，仅支持 .xlsx 或 .xlsm` },
            { status: 400 }
        );
    }

    // 验证文件大小（限制 50MB）
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        return NextResponse.json(
            { ok: false, error: '文件过大，最大支持 50MB' },
            { status: 400 }
        );
    }

    // 确保目录存在
    await mkdir(TEMPLATES_DIR, { recursive: true });

    // 读取文件内容并写入磁盘
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(TEMPLATES_DIR, TEMPLATE_FILENAME);
    await writeFile(filePath, buffer);

    console.log(`[模板上传] 已保存比较法模板: ${filePath} (${(file.size / 1024).toFixed(1)} KB)`);

    return NextResponse.json({
        ok: true,
        message: '比较法模板上传成功',
        size: file.size,
        originalName: file.name,
    });
}, ['admin', 'manager']);
