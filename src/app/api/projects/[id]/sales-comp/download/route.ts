import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

// 路径常量
const PROJECTS_DIR = path.join(process.cwd(), 'data', 'projects');
const PROJECT_WORKBOOK_FILENAME = 'sales_comp.xlsx';

/**
 * GET /api/projects/[id]/sales-comp/download
 * 下载项目的比较法工作簿副本 (.xlsx)
 * 保留所有公式和内部链接
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

        // 检查文件是否存在
        try {
            await stat(workbookPath);
        } catch {
            return NextResponse.json(
                { error: '项目工作簿未找到。请确保母板模板已上传且项目已正确创建。' },
                { status: 404 }
            );
        }

        // 读取文件
        const fileBuffer = await readFile(workbookPath);

        // 返回文件下载响应
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="sales-comp-${projectId}.xlsx"`,
                'Content-Length': String(fileBuffer.length),
            },
        });
    } catch (error) {
        console.error('[工作簿下载] 错误:', error);
        return NextResponse.json(
            { error: '下载失败: ' + String(error) },
            { status: 500 }
        );
    }
}
