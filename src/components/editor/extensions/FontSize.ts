/**
 * Tiptap FontSize 自定义扩展
 * 原生 Tiptap 不提供 FontSize 扩展，需依赖 TextStyle mark 来实现
 * 适用于估价报告的中文字号体系（二号、三号、四号、小四、五号等）
 */
import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            /** 设置选中文字的字号，如 '14pt' */
            setFontSize: (size: string) => ReturnType;
            /** 移除字号设置，恢复默认 */
            unsetFontSize: () => ReturnType;
        };
    }
}

export const FontSize = Extension.create({
    name: 'fontSize',

    addOptions() {
        return {
            types: ['textStyle'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element: HTMLElement) =>
                            element.style.fontSize?.replace(/['"]+/g, '') || null,
                        renderHTML: (attributes: Record<string, unknown>) => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize}` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize:
                (fontSize: string) =>
                    ({ chain }) => {
                        return chain().setMark('textStyle', { fontSize }).run();
                    },
            unsetFontSize:
                () =>
                    ({ chain }) => {
                        return chain()
                            .setMark('textStyle', { fontSize: null })
                            .removeEmptyTextStyle()
                            .run();
                    },
        };
    },
});
