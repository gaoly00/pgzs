/**
 * POST /api/reports/[snapshotId]/export?format=pdf|docx
 *
 * 根据锁定的快照数据生成报告文件。
 *
 * 支持格式：
 * - pdf  → 结构化 HTML（后续用 Puppeteer 替换为真正 PDF）
 * - docx → 使用 docx 库生成 Word 文档
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot, type ReportSnapshot } from '@/lib/snapshot-store';
import { STANDARD_FIELDS } from '@/lib/valuation-schema';
import { verifySession } from '@/lib/auth/session';
import {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    HeadingLevel,
    AlignmentType,
    WidthType,
    BorderStyle,
    ShadingType,
} from 'docx';

// 字段 key → 友好标签映射
const FIELD_LABELS: Record<string, string> = {};
for (const f of STANDARD_FIELDS) {
    FIELD_LABELS[f.key] = f.label;
}

// ============================================================
// HTML 报告生成（用于 PDF 格式）
// ============================================================
function renderReportHTML(snapshot: ReportSnapshot): string {
    const m = snapshot.extractedMetrics;

    const valuationDate = m['valuation_date'] ?? '—';
    const propertyAddress = m['property_address'] ?? '—';
    const unitPrice = m['subject_value_unit'] ?? '—';
    const totalValue = m['subject_value_total'] ?? '—';

    const allMetricsRows = Object.entries(m)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([key, val]) => {
            const label = FIELD_LABELS[key] || key;
            return `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">${label}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;font-family:monospace;">${val}</td></tr>`;
        })
        .join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <title>估价报告 — ${snapshot.projectName}</title>
    <style>
        @page { margin: 20mm; size: A4; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif; color: #1e293b; line-height: 1.6; background: #fff; }
        .container { max-width: 700px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
        .header h1 { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
        .header .subtitle { font-size: 14px; color: #64748b; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 700; color: #334155; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
        .highlight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .highlight-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
        .highlight-card .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .highlight-card .value { font-size: 18px; font-weight: 700; font-family: monospace; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 8px 12px; border: 1px solid #cbd5e1; background: #f1f5f9; font-size: 12px; text-align: left; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
        .result-box { background: linear-gradient(135deg, #ede9fe, #f5f3ff); border: 1px solid #c4b5fd; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        .result-box .label { font-size: 12px; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .result-box .value { font-size: 22px; font-weight: 700; font-family: monospace; color: #4c1d95; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>房地产估价报告</h1>
            <div class="subtitle">${snapshot.projectName}</div>
        </div>
        <div class="section">
            <div class="section-title">基本信息</div>
            <div class="highlight-grid">
                <div class="highlight-card"><div class="label">估价时点</div><div class="value">${valuationDate}</div></div>
                <div class="highlight-card"><div class="label">坐落</div><div class="value">${propertyAddress}</div></div>
            </div>
        </div>
        <div class="section">
            <div class="section-title">估价结论</div>
            <div class="highlight-grid">
                <div class="result-box"><div class="label">单价 (元/㎡)</div><div class="value">${unitPrice}</div></div>
                <div class="result-box"><div class="label">总价 (元)</div><div class="value">${totalValue}</div></div>
            </div>
        </div>
        <div class="section">
            <div class="section-title">全部提取指标</div>
            <table>
                <thead><tr><th style="width:45%">字段</th><th>值</th></tr></thead>
                <tbody>${allMetricsRows || '<tr><td colspan="2" style="padding:12px;text-align:center;color:#94a3b8;">暂无提取数据</td></tr>'}</tbody>
            </table>
        </div>
        <div class="footer">
            <p>快照 ID: ${snapshot.snapshotId}</p>
            <p>生成时间: ${new Date(snapshot.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
            <p style="margin-top:8px;">本报告由 SmartVal 系统自动生成，仅供参考。</p>
        </div>
    </div>
</body>
</html>`;
}

// ============================================================
// DOCX 报告生成
// ============================================================
const BORDER_STYLE = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'CCCCCC',
};

const TABLE_BORDERS = {
    top: BORDER_STYLE,
    bottom: BORDER_STYLE,
    left: BORDER_STYLE,
    right: BORDER_STYLE,
    insideHorizontal: BORDER_STYLE,
    insideVertical: BORDER_STYLE,
};

async function renderReportDOCX(snapshot: ReportSnapshot): Promise<Uint8Array> {
    const m = snapshot.extractedMetrics;

    const valuationDate = String(m['valuation_date'] ?? '—');
    const propertyAddress = String(m['property_address'] ?? '—');
    const unitPrice = String(m['subject_value_unit'] ?? '—');
    const totalValue = String(m['subject_value_total'] ?? '—');

    // 构建核心字段段落
    const keyFieldParagraphs = [
        { label: '估价时点 (Valuation Date)', value: valuationDate },
        { label: '坐落 (Property Address)', value: propertyAddress },
        { label: '单价 (Indicated Unit Price)', value: unitPrice },
        { label: '总价 (Indicated Total Value)', value: totalValue },
    ].map(
        ({ label, value }) =>
            new Paragraph({
                spacing: { after: 120 },
                children: [
                    new TextRun({ text: `${label}：`, bold: true, size: 22 }),
                    new TextRun({ text: value, size: 22 }),
                ],
            }),
    );

    // 构建全量指标表格
    const metricsEntries = Object.entries(m).filter(
        ([, v]) => v !== null && v !== undefined && v !== '',
    );

    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: '字段', bold: true, size: 20 })],
                    }),
                ],
            }),
            new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: '值', bold: true, size: 20 })],
                    }),
                ],
            }),
        ],
    });

    const dataRows = metricsEntries.map(
        ([key, val]) =>
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: FIELD_LABELS[key] || key,
                                        size: 20,
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new TableCell({
                        width: { size: 55, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: String(val),
                                        size: 20,
                                        font: 'Consolas',
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
    );

    const metricsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [headerRow, ...dataRows],
    });

    // 组装文档
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: 'Microsoft YaHei', size: 22 },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                children: [
                    // 标题
                    new Paragraph({
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 },
                        children: [
                            new TextRun({
                                text: '房地产估价报告',
                                bold: true,
                                size: 36,
                            }),
                        ],
                    }),
                    // 副标题（项目名称）
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                        children: [
                            new TextRun({
                                text: snapshot.projectName,
                                size: 24,
                                color: '64748B',
                            }),
                        ],
                    }),

                    // 一、基本信息
                    new Paragraph({
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 240, after: 120 },
                        children: [
                            new TextRun({ text: '一、基本信息', bold: true, size: 28 }),
                        ],
                    }),
                    ...keyFieldParagraphs,

                    // 二、全部提取指标
                    new Paragraph({
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 360, after: 120 },
                        children: [
                            new TextRun({ text: '二、全部提取指标', bold: true, size: 28 }),
                        ],
                    }),
                    metricsTable,

                    // 页脚信息
                    new Paragraph({
                        spacing: { before: 600 },
                        children: [
                            new TextRun({
                                text: `快照 ID: ${snapshot.snapshotId}`,
                                size: 16,
                                color: '94A3B8',
                            }),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `生成时间: ${snapshot.createdAt}`,
                                size: 16,
                                color: '94A3B8',
                            }),
                        ],
                    }),
                    new Paragraph({
                        spacing: { before: 120 },
                        children: [
                            new TextRun({
                                text: '本报告由 SmartVal 系统自动生成，仅供参考。',
                                size: 16,
                                color: '94A3B8',
                                italics: true,
                            }),
                        ],
                    }),
                ],
            },
        ],
    });

    // 转为 Uint8Array 以兼容 NextResponse BodyInit 类型
    const arrayBuffer = await Packer.toBuffer(doc);
    return new Uint8Array(arrayBuffer);
}

// ============================================================
// 路由处理
// ============================================================
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ snapshotId: string }> },
) {
    const { snapshotId } = await params;

    // 鉴权
    const session = await verifySession();
    if (!session) {
        return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') ?? 'pdf';

    if (format !== 'pdf' && format !== 'docx') {
        return NextResponse.json(
            { error: `不支持的导出格式: ${format}，目前支持 pdf / docx` },
            { status: 400 },
        );
    }

    // 查找快照
    const snapshot = getSnapshot(snapshotId);
    if (!snapshot) {
        return NextResponse.json(
            { error: '快照不存在或已过期' },
            { status: 404 },
        );
    }

    try {
        if (format === 'docx') {
            const docBytes = await renderReportDOCX(snapshot);
            return new Response(docBytes.buffer as ArrayBuffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="report-${snapshot.projectId}-${snapshotId}.docx"`,
                },
            });
        }

        // PDF（HTML fallback）
        const html = renderReportHTML(snapshot);
        return new NextResponse(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `attachment; filename="report-${snapshot.projectId}-${snapshotId}.html"`,
            },
        });
    } catch (error) {
        console.error(`[export] ${format} 生成失败:`, error);
        return NextResponse.json(
            { error: `报告生成失败: ${(error as Error).message}` },
            { status: 500 },
        );
    }
}
