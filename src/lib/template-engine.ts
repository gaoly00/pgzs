/**
 * template-engine.ts
 * Word 模板处理引擎
 * 
 * 功能：
 * 1. docx → HTML 转换（mammoth）
 * 2. 占位符提取（{{field_name}} 格式）
 * 3. 占位符替换（结合 extractedMetrics 和项目数据）
 * 4. HTML → Word 导出
 * 5. HTML → PDF 导出
 */

import mammoth from 'mammoth';

// ============================================================
// 占位符提取
// ============================================================

/** 从 HTML 或纯文本中提取所有 {{xxx}} 占位符 */
export function extractPlaceholders(text: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const placeholders = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
        placeholders.add(match[1]);
    }
    return Array.from(placeholders);
}

// ============================================================
// 占位符替换
// ============================================================

/** 
 * 将文本中的 {{xxx}} 占位符替换为实际值
 * 如果没有对应值，保留占位符并用红色标记
 */
export function replacePlaceholders(
    html: string,
    data: Record<string, string | number | null | undefined>,
): string {
    return html.replace(/\{\{(\w+)\}\}/g, (fullMatch, key: string) => {
        const val = data[key];
        if (val !== null && val !== undefined && val !== '') {
            return String(val);
        }
        // 未替换的占位符用红色标记
        return `<span style="color: #ef4444; background: #fef2f2; padding: 0 4px; border-radius: 2px;">【${key}】</span>`;
    });
}

// ============================================================
// docx → HTML 转换
// ============================================================

/** 将 base64 编码的 docx 文件转为 HTML */
export async function docxBase64ToHtml(base64: string): Promise<{
    html: string;
    messages: string[];
}> {
    // 将 base64 转为 ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
            // 保持标题层级映射
            styleMap: [
                "p[style-name='Heading 1'] => h1",
                "p[style-name='Heading 2'] => h2",
                "p[style-name='Heading 3'] => h3",
                "p[style-name='Title'] => h1.doc-title",
            ],
        },
    );

    return {
        html: result.value,
        messages: result.messages.map((m) => m.message),
    };
}

/** 将 File 对象转为 base64 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // 去掉 data:...;base64, 前缀
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================================
// 导出 Word（HTML → docx）
// ============================================================

/** 将 HTML 内容导出为 Word 文档并下载 */
export async function exportToWord(htmlContent: string, fileName: string): Promise<void> {
    // 动态导入 html-docx-js（仅客户端使用）
    // @ts-expect-error — html-docx-js 无 TS 类型
    const htmlDocx = await import('html-docx-js/dist/html-docx');
    const { saveAs } = await import('file-saver');

    // 包装完整 HTML 文档结构
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: "SimSun", "Noto Serif SC", serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #1a1a1a;
        }
        h1 { font-size: 22pt; font-weight: bold; text-align: center; }
        h2 { font-size: 16pt; font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        h3 { font-size: 14pt; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        td, th { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

    const blob = htmlDocx.asBlob(fullHtml);
    saveAs(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
}

// ============================================================
// 导出 PDF（HTML → PDF）
// ============================================================

/** 将 HTML 内容导出为 PDF 并下载 */
export async function exportToPdf(htmlContent: string, fileName: string): Promise<void> {
    // 动态导入 html2pdf.js（仅客户端使用）
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default;

    // 创建临时容器渲染 HTML
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.cssText = `
        font-family: "SimSun", "Noto Serif SC", serif;
        font-size: 14px;
        line-height: 1.8;
        color: #1a1a1a;
        padding: 20mm;
        width: 170mm;
    `;
    document.body.appendChild(container);

    try {
        await html2pdf()
            .set({
                margin: [16, 16, 16, 16],
                filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait',
                },
                pagebreak: {
                    mode: ['avoid-all', 'css', 'legacy'],
                    before: '.page-break-before',
                    after: '.page-break-after',
                    avoid: ['tr', 'td', 'img', 'h1', 'h2', 'h3'],
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            .from(container)
            .save();
    } finally {
        document.body.removeChild(container);
    }
}

// ============================================================
// 辅助函数
// ============================================================

/** 收集项目所有可用于替换占位符的数据 */
export function collectProjectData(project: {
    name: string;
    projectNumber?: string;
    address?: string;
    valuationDate?: string;
    propertyType?: string;
    gfa?: number | null;
    extractedMetrics?: Record<string, string | number | null>;
}): Record<string, string | number | null> {
    const data: Record<string, string | number | null> = {
        // 项目基础字段
        project_name: project.name || null,
        project_number: project.projectNumber || null,
        property_address: project.address || null,
        valuation_date: project.valuationDate || null,
        property_type: project.propertyType || null,
        gfa: project.gfa ?? null,
        report_date: new Date().toLocaleDateString('zh-CN'),
        // 合并提取指标
        ...(project.extractedMetrics ?? {}),
    };
    return data;
}
