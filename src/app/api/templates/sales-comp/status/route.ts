import { NextResponse } from 'next/server';
import { stat } from 'fs/promises';
import path from 'path';
import { withAuth } from '@/lib/auth/with-auth';

// 母板模板存储路径
const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');
const TEMPLATE_FILENAME = 'sales_comp_template.xlsx';

/**
 * GET /api/templates/sales-comp/status
 * 查询比较法母板模板是否已上传
 */
export const GET = withAuth(async () => {
    try {
        const filePath = path.join(TEMPLATES_DIR, TEMPLATE_FILENAME);
        const fileStat = await stat(filePath);

        return NextResponse.json({
            exists: true,
            size: fileStat.size,
            updatedAt: fileStat.mtime.toISOString(),
        });
    } catch {
        // 文件不存在
        return NextResponse.json({
            exists: false,
            size: 0,
            updatedAt: null,
        });
    }
});
