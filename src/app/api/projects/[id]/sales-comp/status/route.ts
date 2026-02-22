import { NextRequest, NextResponse } from 'next/server';
import { stat } from 'fs/promises';
import path from 'path';

// 路径常量
const PROJECTS_DIR = path.join(process.cwd(), 'data', 'projects');
const PROJECT_WORKBOOK_FILENAME = 'sales_comp.xlsx';

/**
 * GET /api/projects/[id]/sales-comp/status
 * 查询项目的比较法工作簿状态
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;

    if (!projectId) {
        return NextResponse.json(
            { error: '缺少项目 ID' },
            { status: 400 }
        );
    }

    try {
        const workbookPath = path.join(PROJECTS_DIR, projectId, PROJECT_WORKBOOK_FILENAME);
        const fileStat = await stat(workbookPath);

        return NextResponse.json({
            exists: true,
            size: fileStat.size,
            updatedAt: fileStat.mtime.toISOString(),
        });
    } catch {
        return NextResponse.json({
            exists: false,
            size: 0,
            updatedAt: null,
        });
    }
}
