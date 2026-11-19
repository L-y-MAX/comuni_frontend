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
        <view class="meta-left">
          <text class="meta-kb">{{ kbName || '加载中…' }}</text>
          <text class="meta-dot">/</text>
          <text>{{ contentLength }} 字</text>
        </view>
        <text
          class="draft-btn"
          @click="saveDraft"
        >
          存草稿
        </text>
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

    <!-- 用 v-if 而不是 v-show：原生 editor 被 display:none 隐藏后再显示，
         部分基础库会把编辑器盖到工具栏上层，导致“预览切回编辑工具栏消失” -->
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

    <view class="publish-bar">
      <button
        class="publish-btn"
        :disabled="submitting"
        @click="handlePublish"
      >
        {{ submitting ? '发布中…' : '发布' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onBackPress } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { marked } from 'marked'
// 知识库正文按纯文本使用：开启 breaks，让普通换行也能分段
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
 * 且会被打进主包的 common/vendor.js，明显拖慢小程序启动。
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
import { addKnowledgeNode, getKnowledgeBaseList } from '@/api/knowledge'
import RichEditor from './components/RichEditor.vue'

interface TocItem {
  id: string
  title: string
  level: number
}

interface FormData {
  name: string
  content: string
  knowledge_base_id: string
}

const highlightCode = (code: string, lang: string) => {
  // 未注册语言时退回自动识别，避免 marked-highlight 抛错导致整篇预览空白
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang }).value
  }
  return hljs.highlightAuto(code).value
}

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight: highlightCode,
  }),
)

const formData = reactive<FormData>({
  name: '',
  content: '',
  knowledge_base_id: '',
})

const kbId = ref('')
const kbName = ref('')
const tab = ref<'edit' | 'preview'>('edit')
const submitting = ref(false)
const renderedContent = ref('')
const maxInputLength = 500000

/** 正文去标签后的字数：用来显示“多少字”，也用来判断是否真的写了内容 */
const contentLength = computed(() =>
  formData.content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, '').length
)

/** 草稿按知识库分开存，避免不同库之间串内容 */
const draftKey = () => `kb_draft_${kbId.value || 'unknown'}`

/** 文章还没有发布时，把标题和正文暂存到本机 */
const saveDraft = () => {
  if (!formData.name.trim() && !formData.content.trim()) {
    uni.showToast({ title: '还没有内容可以存', icon: 'none' })
    return
  }
  const savedAt = `${new Date().getMonth() + 1}月${new Date().getDate()}日 ${String(
    new Date().getHours()
  ).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
  uni.setStorageSync(draftKey(), {
    name: formData.name,
    content: formData.content,
    savedAt,
  })
  uni.showToast({ title: '草稿已保存', icon: 'none' })
}

/** 进页面时如果有草稿，问一下要不要接着写 */
const restoreDraft = () => {
  try {
    const raw = uni.getStorageSync(draftKey())
    if (!raw) return
    const draft = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!draft || (!draft.name && !draft.content)) return

    uni.showModal({
      title: '继续上次的草稿？',
      content: draft.savedAt ? `保存于 ${draft.savedAt}` : '',
      confirmText: '继续编辑',
      cancelText: '删除草稿',
      success: (res) => {
        if (res.confirm) {
          formData.name = draft.name || ''
          formData.content = draft.content || ''
          renderMarkdownAsync()
        } else if (res.cancel) {
          uni.removeStorageSync(draftKey())
        }
      },
    })
  } catch (e) {
    console.warn('读取草稿失败：', e)
  }
}

const initialFormData = ref({ name: '', content: '' })

const hasFormChanged = computed(
  () =>
    formData.name.trim() !== initialFormData.value.name.trim() ||
    formData.content.trim() !== initialFormData.value.content.trim()
)

/**
 * Markdown 排版内联样式表
 *
 * 本页用 v-html 渲染（小程序端等价于 <rich-text>），而 rich-text 不认页面
 * 的 class 选择器，所以样式只能写进节点的 style 属性。
 */
const MD_STYLE: Record<string, string> = {
  h1: 'font-size:40rpx;font-weight:600;color:#17191c;line-height:1.4;margin:36rpx 0 16rpx;',
  h2: 'font-size:36rpx;font-weight:600;color:#17191c;line-height:1.4;margin:32rpx 0 14rpx;',
  h3: 'font-size:32rpx;font-weight:600;color:#17191c;line-height:1.45;margin:28rpx 0 12rpx;',
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

/** highlight.js 类名 → 内联颜色（GitHub Light） */
const HLJS_COLOR: Record<string, string> = {
  keyword: 'color:#d73a49;',
  'selector-tag': 'color:#22863a;',
  'selector-id': 'color:#6f42c1;',
  'selector-class': 'color:#6f42c1;',
  built_in: 'color:#005cc5;',
  type: 'color:#005cc5;',
  literal: 'color:#005cc5;',
  number: 'color:#005cc5;',
  string: 'color:#032f62;',
  regexp: 'color:#032f62;',
  comment: 'color:#8b949e;font-style:italic;',
  quote: 'color:#8b949e;font-style:italic;',
  doctag: 'color:#8b949e;',
  meta: 'color:#8b949e;',
  title: 'color:#6f42c1;',
  section: 'color:#005cc5;',
  name: 'color:#22863a;',
  tag: 'color:#22863a;',
  attr: 'color:#005cc5;',
  attribute: 'color:#005cc5;',
  variable: 'color:#e36209;',
  'template-variable': 'color:#e36209;',
  symbol: 'color:#e36209;',
  bullet: 'color:#735c0f;',
  emphasis: 'font-style:italic;',
  strong: 'font-weight:600;',
  addition: 'color:#22863a;',
  deletion: 'color:#b31d28;',
  link: 'color:#032f62;text-decoration:underline;',
}

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

const extractToc = (content: string): TocItem[] => {
  if (!content) return []
  const toc: TocItem[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*?)\s*$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      toc.push({
        id: `heading-${index}-${title.replace(/\s+/g, '-').toLowerCase()}`,
        title,
        level,
      })
    }
  })

  return toc
}

const renderMarkdown = async (content: string): Promise<string> => {
  if (!content) return ''

  const tocItems = extractToc(content)
  const titleMap = new Map(tocItems.map((item) => [item.title, item.id]))

  let html = await marked.parse(content)

  html = html.replace(
    /<pre><code([^>]*)>/g,
    (_m, attrs: string) =>
      `<pre style="${MD_STYLE.pre}"><code style="${MD_STYLE.preCode}"${attrs}>`
  )
  html = html.split('<code>').join(`<code style="${MD_STYLE.code}">`)

  const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  for (const tag of headingTags) {
    const re = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'g')
    html = html.replace(re, (_m, title: string) => {
      const cleanTitle = String(title).trim()
      const id = titleMap.get(cleanTitle) || `${tag}-${Date.now()}`
      return `<${tag} id="${id}" style="${MD_STYLE[tag]}">${title}</${tag}>`
    })
  }

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
      (whole, attrs?: string) => `<${tag}${attrs || ''} style="${MD_STYLE[tag]}">`
    )
  }

  html = inlineHljsTokens(html)

  // rich-text 不认 <pre>，转成 div + pre-wrap 保内容
  html = html
    .replace(
      /<pre style="([^"]*)">/g,
      '<div style="$1;white-space:pre-wrap;word-break:break-all;">'
    )
    .replace(
      /<pre>/g,
      `<div style="${MD_STYLE.pre};white-space:pre-wrap;word-break:break-all;">`
    )
    .replace(/<\/pre>/g, '</div>')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<\/?(mark|figure|figcaption|details|summary)[^>]*>/gi, '')

  return html
}

/** 预览防抖：停止输入 250ms 后再渲染，长文输入不掉帧 */
let previewTimer: ReturnType<typeof setTimeout> | null = null

const renderMarkdownAsync = async () => {
  renderedContent.value = await renderMarkdown(formData.content)
}

const handleContentInputSync = () => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    previewTimer = null
    renderMarkdownAsync()
  }, 250)
}

const switchPreview = () => {
  tab.value = 'preview'
  renderMarkdownAsync()
}

const handlePublish = async () => {
  if (submitting.value) return

  if (!formData.name.trim()) {
    uni.showToast({ title: '请填写文章标题', icon: 'none' })
    return
  }
  if (!contentLength.value) {
    uni.showToast({ title: '正文还是空的', icon: 'none' })
    return
  }

  submitting.value = true
  let published = false
  try {
    await addKnowledgeNode({
      name: formData.name.trim(),
      content: String(formData.content || '').trim(),
      knowledge_base_id: formData.knowledge_base_id,
    })
    published = true
    uni.removeStorageSync(draftKey())
    initialFormData.value = {
      name: formData.name,
      content: formData.content,
    }
    uni.showToast({ title: '已发布', icon: 'success' })

    setTimeout(() => {
      uni.navigateBack({
        delta: 1,
        success: () => {
          const pages = getCurrentPages()
          const prevPage = pages[pages.length - 2]
          if (prevPage?.$vm?.selectKb) {
            prevPage.$vm.selectKb(kbId.value)
          }
        },
      })
    }, 700)
  } catch (error: any) {
    console.error('新增文章失败：', error)
    uni.showToast({
      title: error?.message || '发布失败，请重试',
      icon: 'none',
    })
  } finally {
    if (!published) submitting.value = false
  }
}

/** 有未发布内容时，退出前确认一次 */
onBackPress((options) => {
  if (options.from !== 'backbutton') return false
  if (!hasFormChanged.value) return false

  uni.showModal({
    title: '放弃这篇未发布的文章？',
    content: '离开后写好的内容不会保留。',
    confirmText: '放弃',
    cancelText: '继续写',
    success: (res) => {
      if (res.confirm) uni.navigateBack()
    },
  })

  return true
})

onLoad(async (options: any) => {
  if (!options.kbId) {
    uni.showToast({ title: '缺少知识库信息', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1200)
    return
  }

  kbId.value = options.kbId
  formData.knowledge_base_id = options.kbId

  try {
    const kbListRes = await getKnowledgeBaseList()
    const targetKb = kbListRes.results.find((item) => item.id === kbId.value)
    kbName.value = targetKb?.name || '未知知识库'
  } catch (error) {
    console.error('获取知识库名称失败：', error)
    kbName.value = '未知知识库'
  }

  initialFormData.value = { name: '', content: '' }
  restoreDraft()
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

.title-ph {
  color: #c2c6cc;
  font-weight: 500;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}

.meta-kb {
  max-width: 420rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.meta-dot {
  margin: 0 12rpx;
}

.meta-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.draft-btn {
  flex: none;
  margin-left: 24rpx;
  padding: 12rpx 0 12rpx 24rpx;
  font-size: 28rpx;
  color: #5b616b;
}

.draft-btn:active {
  color: #ff6a33;
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

.publish-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
  border-top: 1rpx solid #ececf0;
}

.publish-btn {
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

.publish-btn:active {
  background-color: #ee5a22;
}

.publish-btn[disabled] {
  color: #9aa0a8;
  background-color: #eceef1;
}
</style>
