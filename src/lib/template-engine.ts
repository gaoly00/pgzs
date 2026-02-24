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
// 导出 Word（通过服务端 API）
// ============================================================

/**
 * 将编辑器 HTML 导出为 Word 文档并下载
 * @param htmlContent 编辑器 HTML 内容
 * @param fileName 文件名（不含扩展名）
 * @param snapshotId 快照 ID（用于 API 路由）
 */
export async function exportToWord(htmlContent: string, fileName: string, snapshotId?: string): Promise<void> {
    if (!snapshotId) {
        throw new Error('需要 snapshotId 才能导出');
    }

    const res = await fetch(`/api/reports/${snapshotId}/export?format=docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '导出 Word 失败');
    }

    const blob = await res.blob();
    const { saveAs } = await import('file-saver');
    saveAs(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
}

// ============================================================
// 导出 PDF（通过浏览器 window.print）
// ============================================================

/**
 * 将编辑器 HTML 导出为 PDF
 * 通过服务端生成带打印样式的 HTML，然后用 window.print() 触发浏览器原生 PDF 打印
 */
export async function exportToPdf(htmlContent: string, fileName: string, snapshotId?: string): Promise<void> {
    if (!snapshotId) {
        throw new Error('需要 snapshotId 才能导出');
    }

    const res = await fetch(`/api/reports/${snapshotId}/export?format=html-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '导出 PDF 失败');
    }

    const printHtml = await res.text();

    // 在新窗口中打开并触发打印
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        throw new Error('无法打开打印窗口，请检查浏览器弹窗设置');
    }
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
    };
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
