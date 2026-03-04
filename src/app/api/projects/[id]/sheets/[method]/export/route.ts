/**
 * Excel 导出 API
 * GET /api/projects/[id]/sheets/[method]/export — 导出工作簿为 Excel 文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { getProject } from '@/lib/repositories/project-repo';
import { getSheetData } from '@/lib/repositories/sheet-repo';
import * as XLSX from 'xlsx';

/** GET — 导出工作簿为 Excel */
export const GET = withAuth(async (
    _request: NextRequest,
    session,
    { params }: { params: Promise<{ id: string; method: string }> }
) => {
    const { id: projectId, method } = await params;

    // 校验项目归属
    const project = getProject(session.tenantId, projectId);
    if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // 获取工作簿数据
    const sheetData = getSheetData(session.tenantId, projectId, method);
    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
        return NextResponse.json({ error: '工作簿数据不存在' }, { status: 404 });
    }

    try {
        // 创建新的工作簿
        const workbook = XLSX.utils.book_new();

        // 遍历所有 sheet
        for (const sheet of sheetData) {
            const sheetName = sheet.name || 'Sheet1';
            const celldata = sheet.celldata || [];

            // 确定工作表尺寸
            const maxRow = sheet.row || 100;
            const maxCol = sheet.column || 26;

            // 创建二维数组
            const data: any[][] = Array.from({ length: maxRow }, () => Array(maxCol).fill(null));

            // 填充单元格数据
            for (const cell of celldata) {
                const r = cell.r;
                const c = cell.c;
                if (r >= 0 && r < maxRow && c >= 0 && c < maxCol && cell.v) {
                    // 提取单元格值
                    let value = cell.v.v;

                    // 处理不同类型的值
                    if (value !== undefined && value !== null) {
                        // 如果是公式，使用计算后的值
                        if (cell.v.f) {
                            value = cell.v.v || cell.v.f;
                        }
                        data[r][c] = value;
                    }
                }
            }

            // 创建工作表
            const worksheet = XLSX.utils.aoa_to_sheet(data);

            // 应用列宽（如果有配置）
            if (sheet.config?.columnlen) {
                const cols: any[] = [];
                for (const [colIndex, width] of Object.entries(sheet.config.columnlen)) {
                    cols[parseInt(colIndex)] = { wch: Math.floor((width as number) / 8) };
                }
                worksheet['!cols'] = cols;
            }

            // 应用行高（如果有配置）
            if (sheet.config?.rowlen) {
                const rows: any[] = [];
                for (const [rowIndex, height] of Object.entries(sheet.config.rowlen)) {
                    rows[parseInt(rowIndex)] = { hpt: height as number };
                }
                worksheet['!rows'] = rows;
            }

            // 添加到工作簿
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }

        // 生成 Excel 文件
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // 生成文件名：项目名称_估价方法_日期.xlsx
        const date = new Date().toISOString().split('T')[0];
        const methodLabel = getMethodLabel(method);
        const fileName = `${project.name}_${methodLabel}_${date}.xlsx`;

        // 返回文件
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
            },
        });
    } catch (error) {
        console.error('[Excel Export] 导出失败:', error);
        return NextResponse.json({ error: '导出失败' }, { status: 500 });
    }
});

/** 获取估价方法的中文标签 */
function getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
        'sales-comp': '比较法',
        'cost-approach': '成本法',
        'income-approach': '收益法',
        'hypothetical-dev': '假设开发法',
        'benchmark-land-price': '公示地价',
        'residual-method': '剩余法',
        'land-sales-comp': '市场比较法',
        'land-income': '收益还原法',
        'cost-approach-land': '成本逼近法',
    };
    return labels[method] || method;
}
