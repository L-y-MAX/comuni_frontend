/**
 * 知识库纯文本工具
 *
 * 设计前提：**大部分人不会写 Markdown**。AI 回答里带 `**加粗**`、`## 标题`、
 * 表格竖线、代码围栏，直接写进知识库，用户看到的是满屏符号。
 * 所以写入前统一把 Markdown 语法还原成普通文字，展示侧再按纯文本渲染。
 */

/** 知识库正文长度上限（与编辑器 maxlength 保持一致；后端为 TextField，无硬限制） */
export const KB_CONTENT_LIMIT = 500000

/**
 * 把 Markdown 还原成普通文字。
 * 只做"去语法"，不改写用词、不丢内容——列表符号统一成「· 」，段落换行保留。
 */
export const stripMarkdown = (input: string): string => {
  if (!input) return ''
  let text = String(input).replace(/\r\n/g, '\n')

  // 1. 代码围栏：去掉 ``` 行，保留代码本身
  text = text.replace(/^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm, '$1')
  text = text.replace(/^[ \t]*```[^\n]*$/gm, '')
  // 行内代码
  text = text.replace(/`([^`\n]+)`/g, '$1')

  // 2. 图片 → alt；链接 → 链接文字
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

  // 3. 标题、引用、分割线
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
  text = text.replace(/^[ \t]{0,3}>[ \t]?/gm, '')
  text = text.replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, '')

  // 4. 表格：去掉分隔行，竖线换成空格
  text = text.replace(/^[ \t]*\|?[ \t:|-]+\|[ \t:|-]*$/gm, '')
  text = text.replace(/[ \t]*\|[ \t]*/g, ' ')

  // 5. 强调标记
  text = text.replace(/(\*\*|__)(.+?)\1/g, '$2')
  text = text.replace(/~~(.+?)~~/g, '$1')
  text = text.replace(/(^|[\s(])([*_])([^*_\n]+?)\2(?=[\s).,，。；:：]|$)/gm, '$1$3')

  // 6. HTML 标签（AI 偶尔会带 <br> 之类）
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '')

  // 7. 列表符号：无序统一成「· 」，有序保留数字
  text = text.replace(/^[ \t]*[-*+][ \t]+/gm, '· ')
  text = text.replace(/^[ \t]*(\d+)[.)][ \t]+/gm, '$1. ')

  // 8. 清理：行尾空白、多余空行
  text = text.replace(/[ \t]+$/gm, '')
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

/** 写入知识库前统一处理：去 Markdown + 截断到上限 */
export const toKbContent = (input: string): string => stripMarkdown(input).slice(0, KB_CONTENT_LIMIT)

/** 判断一段内容是不是富文本编辑器产出的 HTML（用于兼容历史纯文本/Markdown 文章） */
export const looksLikeHtml = (input: string): boolean =>
  /<\/?[a-zA-Z][^>]*>/.test(String(input || ''))

/**
 * 纯文本 → 简易 HTML：按空行分段、段内换行转 <br>。
 * 编辑历史文章时用它把旧的纯文本灌进富文本编辑器，避免所有换行糊成一行。
 */
export const textToHtml = (input: string): string => {
  const text = String(input || '').replace(/\r\n/g, '\n')
  if (!text.trim()) return ''
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escape(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
