<template>
  <view class="page">
    <view class="compose">
      <input
        v-model="formData.name"
        class="title-input"
        placeholder="文章标题"
        placeholder-style="color:#b6bac1"
        :maxlength="60"
      />

      <view class="meta">
        <text>{{ contentLength }} 字</text>
      </view>
    </view>

    <view class="switch">
      <view
        class="switch-item"
        :class="{ on: tab === 'edit' }"
        @click="tab = 'edit'"
      >
        编辑
      </view>
      <view
        class="switch-item"
        :class="{ on: tab === 'preview' }"
        @click="switchPreview"
      >
        预览
      </view>
    </view>

    <!-- 用 v-if 而不是 v-show：原生 editor 被隐藏后再显示会出现工具栏被盖住的问题 -->
    <view
      v-if="tab === 'edit'"
      class="pane"
    >
      <RichEditor
        v-model:html="formData.content"
        :maxlength="maxInputLength"
        placeholder="从这里开始写正文"
        @change="handleContentInputSync"
      />
    </view>

    <scroll-view
      v-else
      class="pane pane--preview"
      scroll-y
    >
      <view
        v-if="renderedContent"
        class="markdown-body"
        v-html="renderedContent"
      />
      <view
        v-else
        class="preview-empty"
      >
        还没有可预览的内容
      </view>
    </scroll-view>

    <view class="save-bar">
      <button
        class="save-btn"
        :disabled="submitting"
        @click="handleBtnClick"
      >
        {{ submitting ? '保存中…' : type === 'edit' ? '保存' : '发布' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onBackPress } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { marked } from 'marked'
// 知识库正文按纯文本使用：开启 breaks，让普通换行也能分段（否则会被合并成一行）
marked.setOptions({ breaks: true })
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import markdown from 'highlight.js/lib/languages/markdown'

/**
 * 只注册常用语言。
 *
 * 默认入口 `highlight.js` 会带上全部 190+ 种语言定义（源码 5MB+），
 * 且会被打进**主包**的 common/vendor.js，显著拖慢小程序启动与首页渲染。
 * 笔记里真正会写的代码就这十种，按需注册即可，高亮能力不受影响。
 */
// 部分基础库不支持 highlight.js 11 的 Unicode 属性正则（如 python 的 \p{XID_Start}），
// 注册失败时跳过该语言，不能让整个页面初始化中断。
const registerLanguage = (name: string, lang: any) => {
  try {
    hljs.registerLanguage(name, lang)
  } catch (e) {
    console.warn(`[highlight] ${name} 语法注册失败，已跳过`)
  }
}

registerLanguage('javascript', javascript)
registerLanguage('js', javascript)
registerLanguage('typescript', typescript)
registerLanguage('ts', typescript)
registerLanguage('json', json)
registerLanguage('bash', bash)
registerLanguage('shell', bash)
registerLanguage('python', python)
registerLanguage('java', java)
registerLanguage('xml', xml)
registerLanguage('html', xml)
registerLanguage('css', css)
registerLanguage('sql', sql)
registerLanguage('markdown', markdown)
import { markedHighlight } from 'marked-highlight'

import type { KnowledgeNode } from '@/types/knowledge'

// 直接引入接口文件中的方法（无需重复封装请求）
import { getKnowledgeNodeDetail, addKnowledgeNode, updateKnowledgeNode } from '@/api/knowledge'
import RichEditor from './components/RichEditor.vue'
import { looksLikeHtml, textToHtml } from '@/utils/plainText'

// ========== 类型定义 ==========
interface TocItem {
  id: string
  title: string
  level: number
}

interface FormData {
  id: string
  name: string
  content: string
  knowledge_base_id: string
  description: string
}

// ========== 抽离 highlight 函数（兼容小程序编译） ==========
const highlightCode = (code: string, lang: string) => {
  // 注意：'plaintext' 在 highlight.js core 里并没有注册，
  // 直接 hljs.highlight(code, { language: 'plaintext' }) 会抛
  // Unknown language —— 而 marked-highlight 的 highlight 回调一旦抛错，
  // 整个 marked.parse 都会失败：文章正文空白、实时预览挂掉。
  // 所以未注册语言时退回自动识别（highlightAuto 自带兜底，识别不出就原样返回）。
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang }).value
  }
  return hljs.highlightAuto(code).value
}

// 初始化 marked
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight: highlightCode,
  }),
)

// ========== 响应式数据 ==========
const formData = reactive<FormData>({
  id: '',
  name: '',
  content: '',
  knowledge_base_id: '',
  description: '',
})

// 记录初始值：用于对比是否有修改
const initialFormData = ref<{ name: string; content: string }>({
  name: '',
  content: '',
})

const type = ref<string>('edit')
const kbId = ref<string>('')

const renderedContent = ref<string>('')
const tab = ref<'edit' | 'preview'>('edit')
const submitting = ref(false)

// ========== 计算属性 ==========
// 正文去标签后的字数，同时用于判断是否真的写了内容
const contentLength = computed(() =>
  formData.content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, '').length
)

// 输入字数限制配置 最多字数 50w
const maxInputLength = ref(500000) // 设定最大输入字数，可自行调整

// 判断是否有内容修改：对比当前值和初始值
const hasFormChanged = computed(() => {
  return (
    formData.name.trim() !== initialFormData.value.name.trim() ||
    formData.content.trim() !== initialFormData.value.content.trim()
  )
})

// ========== 核心方法 ==========

/**
 * 提取Markdown标题生成目录
 */
const extractToc = (content: string): TocItem[] => {
  if (!content) return []

  const toc: TocItem[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*?)\s*$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      const id = `heading-${index}-${title.replace(/\s+/g, '-').toLowerCase()}`

      toc.push({ id, title, level })
    }
  })

  return toc
}

/**
 * 渲染Markdown为HTML字符串
 */
/**
 * Markdown 排版内联样式表
 *
 * 为什么必须写内联：本页用 v-html 渲染（小程序端等价于 <rich-text>），
 * 而 <rich-text> **不认页面 WXSS 的 class 选择器** —— 原来这里加的是
 * class="md-h1" / class="md-p" 之类，下方那几十行 .md-* 样式从来没生效过。
 * 唯一可靠的做法是把样式写进节点的 style 属性。
 */
const MD_STYLE: Record<string, string> = {
  h1: 'font-size:40rpx;font-weight:600;color:#17191c;line-height:1.4;margin:36rpx 0 16rpx;',
  h2: 'font-size:34rpx;font-weight:600;color:#17191c;line-height:1.4;margin:32rpx 0 14rpx;',
  h3: 'font-size:30rpx;font-weight:600;color:#17191c;line-height:1.45;margin:28rpx 0 12rpx;',
  h4: 'font-size:30rpx;font-weight:600;color:#17191c;line-height:1.45;margin:24rpx 0 10rpx;',
  h5: 'font-size:28rpx;font-weight:600;color:#17191c;line-height:1.45;margin:20rpx 0 10rpx;',
  h6: 'font-size:26rpx;font-weight:600;color:#5b616b;line-height:1.45;margin:18rpx 0 8rpx;',
  p: 'font-size:30rpx;line-height:1.8;color:#33373d;margin:16rpx 0;',
  ul: 'padding-left:40rpx;margin:16rpx 0;font-size:30rpx;line-height:1.8;color:#33373d;',
  ol: 'padding-left:40rpx;margin:16rpx 0;font-size:30rpx;line-height:1.8;color:#33373d;',
  li: 'font-size:30rpx;line-height:1.8;color:#33373d;margin:6rpx 0;',
  blockquote:
    'margin:20rpx 0;padding:4rpx 0 4rpx 22rpx;border-left:6rpx solid #e3e5e9;color:#5b616b;font-size:28rpx;line-height:1.75;',
  hr: 'height:1rpx;background:#ececf0;border:none;margin:32rpx 0;',
  a: 'color:#ff6a33;text-decoration:none;',
  strong: 'font-weight:600;color:#17191c;',
  em: 'font-style:italic;color:#5b616b;',
  table: 'width:100%;border-collapse:collapse;margin:16rpx 0;font-size:26rpx;',
  th: 'border:1rpx solid #e8eaee;padding:12rpx 14rpx;background:#fafbfc;font-weight:500;text-align:left;',
  td: 'border:1rpx solid #e8eaee;padding:12rpx 14rpx;',
  img: 'max-width:100%;height:auto;border-radius:8rpx;',
  pre: 'padding:24rpx;background:#f7f8fa;border-radius:12rpx;margin:20rpx 0;white-space:pre-wrap;word-break:break-all;',
  preCode:
    'font-family:Consolas,Menlo,monospace;font-size:26rpx;background:transparent;color:#24292e;padding:0;',
  code: 'font-family:Consolas,Menlo,monospace;font-size:26rpx;background:#f2f3f5;color:#c7254e;padding:2rpx 8rpx;border-radius:4rpx;',
}

/**
 * highlight.js 语法着色表（GitHub Light 配色）
 *
 * 同样必须内联：hljs 只会输出 class="hljs-keyword" 这类类名，
 * 而 rich-text 里类名无效，项目里也没有引入任何 hljs 主题样式，
 * 所以这里把类名直接翻译成内联颜色。
 */
const HLJS_COLOR: Record<string, string> = {
  keyword: 'color:#d73a49;font-weight:600;',
  'selector-tag': 'color:#22863a;font-weight:600;',
  'selector-id': 'color:#6f42c1;font-weight:600;',
  'selector-class': 'color:#6f42c1;',
  built_in: 'color:#005cc5;',
  type: 'color:#005cc5;',
  literal: 'color:#005cc5;',
  number: 'color:#005cc5;',
  string: 'color:#032f62;',
  regexp: 'color:#032f62;',
  comment: 'color:#6a737d;font-style:italic;',
  quote: 'color:#6a737d;font-style:italic;',
  doctag: 'color:#6a737d;',
  meta: 'color:#6a737d;',
  title: 'color:#6f42c1;font-weight:600;',
  section: 'color:#005cc5;font-weight:600;',
  name: 'color:#22863a;',
  tag: 'color:#22863a;',
  attr: 'color:#005cc5;',
  attribute: 'color:#005cc5;',
  variable: 'color:#e36209;',
  'template-variable': 'color:#e36209;',
  symbol: 'color:#e36209;',
  bullet: 'color:#735c0f;',
  emphasis: 'font-style:italic;',
  strong: 'font-weight:700;',
  addition: 'color:#22863a;',
  deletion: 'color:#b31d28;',
  link: 'color:#032f62;text-decoration:underline;',
}

/** 把 highlight.js 输出的类名翻译成内联 style */
const inlineHljsTokens = (html: string): string =>
  html.replace(/<span class="([^"]+)">/g, (whole, classes: string) => {
    const names = String(classes).split(/\s+/)
    for (const n of names) {
      if (!n.startsWith('hljs-')) continue
      const style = HLJS_COLOR[n.slice(5)]
      if (style) return `<span style="${style}">`
    }
    return whole
  })

/**
 * 渲染Markdown为HTML字符串（全部使用内联样式，适配 rich-text）
 */
const renderMarkdown = async (content: string): Promise<string> => {
  if (!content) return ''

  const tocItems = extractToc(content)
  const titleMap = new Map(tocItems.map((item) => [item.title, item.id]))

  let html = await marked.parse(content)

  // 代码块要按 <pre><code> 整体处理，否则行内 code 的底色会串进代码块
  html = html.replace(
    /<pre><code([^>]*)>/g,
    (_m, attrs: string) =>
      `<pre style="${MD_STYLE.pre}"><code style="${MD_STYLE.preCode}"${attrs}>`,
  )
  // 行内代码（此时 <code> 已带属性的不会命中）
  html = html.split('<code>').join(`<code style="${MD_STYLE.code}">`)

  // 标题：加锚点 id（供目录跳转）+ 内联样式
  const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  for (const tag of headingTags) {
    const re = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'g')
    html = html.replace(re, (_m, title: string) => {
      const cleanTitle = String(title).trim()
      const id = titleMap.get(cleanTitle) || `${tag}-${Date.now()}`
      return `<${tag} id="${id}" style="${MD_STYLE[tag]}">${title}</${tag}>`
    })
  }

  // 其余块级/行内元素：统一补内联样式（允许带属性，如 <a href>、<th align>）
  const styledTags = [
    'p',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'a',
    'strong',
    'em',
    'table',
    'th',
    'td',
    'img',
  ]
  for (const tag of styledTags) {
    const re = new RegExp('<' + tag + '(\\s[^>]*)?>', 'g')
    html = html.replace(
      re,
      (whole, attrs?: string) => `<${tag}${attrs || ''} style="${MD_STYLE[tag]}">`,
    )
  }

  // 最后把 highlight.js 的类名翻译成内联颜色
  html = inlineHljsTokens(html)

  // ---- rich-text 兼容适配 ----
  // 微信 <rich-text> 不认 <pre> 标签（代码块会丢内容/错乱），统一转成 <div>，
  // 并用 white-space:pre-wrap 保留换行与缩进。
  html = html
    .replace(
      /<pre style="([^"]*)">/g,
      '<div style="$1;white-space:pre-wrap;word-break:break-all;">',
    )
    .replace(
      /<pre>/g,
      `<div style="${MD_STYLE.pre};white-space:pre-wrap;word-break:break-all;">`,
    )
    .replace(/<\/pre>/g, '</div>')
    // 清理 rich-text 不支持的标签（任务列表复选框、mark、figure、details 等）
    .replace(/<input[^>]*>/gi, '')
    .replace(/<\/?(mark|figure|figcaption|details|summary)[^>]*>/gi, '')

  return html
}

/**
 * Markdown 预览防抖定时器
 *
 * 原来每次 @input 都会同步跑一遍 marked.parse + 十余次正则全量替换，
 * 长文输入时明显掉帧。改为停止输入 250ms 后再渲染预览。
 * （提交用的是 formData.content 原始文本，不受预览延迟影响）
 */
let previewTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 同步编辑内容并渲染Markdown（防抖）
 */
const handleContentInputSync = () => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    previewTimer = null
    renderMarkdownAsync()
  }, 250)
}

/**
 * 异步渲染Markdown
 */
const renderMarkdownAsync = async () => {
  renderedContent.value = await renderMarkdown(formData.content)
}

/**
 * 获取文章详情（直接使用接口文件方法）
 */
const fetchNodeDetail = async (id: string) => {
  try {
    const res = (await getKnowledgeNodeDetail(id)) as KnowledgeNode
    formData.name = res.name
    // 历史文章可能是纯文本/Markdown，富文本编辑器需要 HTML 才能保留分段
    formData.content = looksLikeHtml(res.content) ? res.content : textToHtml(res.content)
    formData.description = res.description
    formData.knowledge_base_id = res.knowledge_base_id

    // 记录编辑模式的初始值（用转换后的 HTML，避免纯文本被转成 HTML 后误判为“有修改”）
    initialFormData.value = {
      name: res.name,
      content: formData.content,
    }

    renderedContent.value = await renderMarkdown(formData.content)
  } catch (error) {
    console.error('加载文章详情失败：', error)
    uni.showToast({ title: '加载详情失败', icon: 'none' })
  }
}

/** 校验：标题和正文都不能为空 */
const validateForm = (): boolean => {
  if (!formData.name.trim()) {
    uni.showToast({ title: '请填写文章标题', icon: 'none' })
    return false
  }
  if (!contentLength.value) {
    uni.showToast({ title: '正文还是空的', icon: 'none' })
    return false
  }
  return true
}

const switchPreview = () => {
  tab.value = 'preview'
  renderMarkdownAsync()
}

/** 按钮入口 */
const handleBtnClick = async () => {
  if (!validateForm()) return
  await submit()
}

/** 提交（编辑 / 新增） */
const submit = async () => {
  if (submitting.value) return

  formData.content = String(formData.content || '').trim()
  submitting.value = true
  let saved = false

  try {
    if (type.value === 'edit') {
      await updateKnowledgeNode(formData.id, {
        name: formData.name,
        content: formData.content,
        description: formData.description,
        knowledge_base_id: formData.knowledge_base_id,
      })
      uni.showToast({ title: '已保存', icon: 'success' })
    } else {
      await addKnowledgeNode({
        name: formData.name,
        content: formData.content,
        description: formData.description,
        knowledge_base_id: formData.knowledge_base_id,
      })
      uni.showToast({ title: '已发布', icon: 'success' })
    }

    saved = true
    initialFormData.value = {
      name: formData.name,
      content: formData.content,
    }

    setTimeout(() => {
      uni.navigateBack({
        success: () => {
          // 回到知识库页后刷新文章列表，否则标题/内容还是旧的
          const pages = getCurrentPages()
          const prevPage = pages[pages.length - 2]
          if (prevPage?.$vm?.selectKb && formData.knowledge_base_id) {
            prevPage.$vm.selectKb(formData.knowledge_base_id, true, true)
          }
        },
      })
    }, 700)
  } catch (error: any) {
    console.error('提交文章失败：', error)
    uni.showToast({
      title: error?.message || '操作失败，请重试',
      icon: 'none',
    })
  } finally {
    if (!saved) submitting.value = false
  }
}

/** 有未保存修改时，返回前确认一次 */
onBackPress((options) => {
  if (options.from !== 'backbutton') return false
  if (!hasFormChanged.value) return false

  uni.showModal({
    title: '放弃未保存的修改？',
    content: '离开后这次改动不会保留。',
    confirmText: '放弃',
    cancelText: '继续编辑',
    success: (res) => {
      if (res.confirm) uni.navigateBack()
    },
  })

  return true
})

// ========== 生命周期 ==========
onLoad((options: any) => {
  type.value = options.type || 'edit'
  kbId.value = options.kbId || ''

  initialFormData.value = {
    name: '',
    content: '',
  }

  if (options.id) {
    formData.id = options.id
    formData.knowledge_base_id = kbId.value
    fetchNodeDetail(options.id)
  }
  if (type.value === 'add' && kbId.value) {
    formData.knowledge_base_id = kbId.value
  }
})
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.compose {
  padding: 32rpx 32rpx 24rpx;
  background-color: #ffffff;
}

.title-input {
  width: 100%;
  height: 76rpx;
  font-size: 40rpx;
  font-weight: 600;
  color: #17191c;
  line-height: 1.35;
}

.meta {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}

.switch {
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  background-color: #ffffff;
  border-bottom: 1rpx solid #ececf0;
}

.switch-item {
  position: relative;
  margin-right: 48rpx;
  padding: 20rpx 0 22rpx;
  font-size: 28rpx;
  color: #5b616b;
}

.switch-item.on {
  color: #17191c;
  font-weight: 600;
}

.switch-item.on::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 6rpx;
  border-radius: 3rpx;
  background-color: #17191c;
}

.pane {
  background-color: #ffffff;
}

.pane--preview {
  height: 900rpx;
  padding: 8rpx 32rpx 40rpx;
}

.markdown-body {
  width: 100%;
}

.preview-empty {
  padding: 160rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #9aa0a8;
}

.save-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
  border-top: 1rpx solid #ececf0;
}

.save-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #ffffff;
  background-color: #ff6a33;
  border: none;
  border-radius: 12rpx;
}

.save-btn:active {
  background-color: #ee5a22;
}

.save-btn[disabled] {
  color: #9aa0a8;
  background-color: #eceef1;
}
</style>
