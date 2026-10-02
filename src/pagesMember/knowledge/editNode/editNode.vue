<template>
  <!-- 根容器：确保页面结构完整 -->
  <view class="node-detail-page">
    <!-- 页面主区域：移除scroll-view，改用普通view承载表单 -->
    <view class="content-container">
      <!-- 表单容器：统一校验逻辑 -->
      <!-- 关键修改：添加 ref="formRef" + id="formRef"，兼容小程序 -->
      <uni-forms
        ref="formRef"
        id="formRef"
        :model="formData"
        :rules="formRules"
        class="form-container"
      >
        <!-- 文章名称输入项：新增保存按钮同行显示 -->
        <uni-forms-item
          label="文章名称"
          required
          name="name"
          class="form-item name-item"
        >
          <view class="name-input-wrapper">
            <view class="name-input-icon">📝</view>
            <input
              v-model="formData.name"
              placeholder="请输入文章名称"
              class="name-input"
              :focused="nameInputFocused"
              @focus="nameInputFocused = true"
              @blur="nameInputFocused = false"
            />
            <!-- 保存按钮：添加点击日志 -->
            <button
              class="save-btn"
              @click="handleBtnClick"
              :disabled="isSubmitDisabled"
            >
              {{ type === 'edit' ? '保存' : '新增文章' }}
            </button>
          </view>
        </uni-forms-item>

        <!-- 文章内容编辑项：预览+编辑双独立滚动 -->
        <uni-forms-item
          label="内容"
          name="content"
          class="form-item content-item"
        >
          <!-- 预览区标题 -->
          <view class="content-section-title">实时预览</view>
          <!-- 预览区容器：固定高度+溢出隐藏 -->
          <view class="preview-wrapper">
            <scroll-view
              class="preview-scroll"
              scroll-y
              scroll-with-animation
            >
              <view class="detail-content">
                <view
                  class="markdown-body"
                  v-html="renderedContent"
                ></view>
              </view>
            </scroll-view>
          </view>

          <!-- 编辑区标题 -->
          <view class="content-section-title">编辑内容</view>
          <!-- 编辑区容器：核心隔离滚动 -->
          <view class="editor-wrapper">
            <scroll-view
              class="editor-scroll"
              scroll-y
              scroll-with-animation
              scroll-boundary="inside"
            >
              <textarea
                v-model="formData.content"
                placeholder="请输入文章内容（支持Markdown）"
                class="content-textarea"
                :maxlength="maxInputLength"
                :focused="contentInputFocused"
                @focus="handleContentFocus"
                @blur="contentInputFocused = false"
                @input="handleContentInputSync"
                @touchmove.stop="true"
                resize="none"
              ></textarea>
            </scroll-view>
          </view>
        </uni-forms-item>
      </uni-forms>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onReady, onBackPress } from '@dcloudio/uni-app'
import { computed, reactive, ref, getCurrentInstance, nextTick } from 'vue'
import { marked } from 'marked'
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
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('python', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('markdown', markdown)
import { markedHighlight } from 'marked-highlight'

import type { KnowledgeNode } from '@/types/knowledge'

// 直接引入接口文件中的方法（无需重复封装请求）
import { getKnowledgeNodeDetail, addKnowledgeNode, updateKnowledgeNode } from '@/api/knowledge'

// ========== 声明 UniFormsInstance 类型（解决 TS 报错） ==========
declare type UniFormsInstance = {
  validate: (names?: string | string[]) => Promise<void>
  validateField: (fields: string | string[]) => Promise<void>
}

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

const nameInputFocused = ref<boolean>(false)
const contentInputFocused = ref<boolean>(false)

const renderedContent = ref<string>('')

// 关键修改1：初始化formRef，并通过getCurrentInstance兼容小程序
const formRef = ref<UniFormsInstance | null>(null)
const instance = getCurrentInstance()

// ========== 计算属性 ==========
// 提交按钮禁用逻辑：添加日志
const isSubmitDisabled = computed(() => {
  const disabled = !formData.name.trim() || !formData.content.trim()
  return disabled
})

// 输入字数限制配置 最多字数 50w
const maxInputLength = ref(500000) // 设定最大输入字数，可自行调整

// 判断是否有内容修改：对比当前值和初始值
const hasFormChanged = computed(() => {
  return (
    formData.name.trim() !== initialFormData.value.name.trim() ||
    formData.content.trim() !== initialFormData.value.content.trim()
  )
})

// ========== 表单校验规则 ==========
const formRules = ref({
  name: {
    required: true,
    errorMessage: '文章名称不能为空',
  },
  content: {
    required: true,
    errorMessage: '文章内容不能为空',
  },
})

// ========== 核心方法 ==========
/**
 * 编辑框聚焦逻辑
 */
const handleContentFocus = () => {
  contentInputFocused.value = true
  // 原来这里会调 stopPageScroll() 把页面强制拉回顶部。
  // 页面本身已不再锁滚动，再拉回顶部只会让用户正在编辑的区域跑出屏幕。
}

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
  h1: 'font-size:44rpx;font-weight:700;color:#1f2937;line-height:1.4;margin:32rpx 0 16rpx;padding-bottom:12rpx;border-bottom:2rpx solid #eceff3;',
  h2: 'font-size:38rpx;font-weight:700;color:#1f2937;line-height:1.4;margin:28rpx 0 14rpx;padding-bottom:10rpx;border-bottom:2rpx solid #eceff3;',
  h3: 'font-size:34rpx;font-weight:600;color:#1f2937;line-height:1.45;margin:24rpx 0 12rpx;',
  h4: 'font-size:32rpx;font-weight:600;color:#374151;line-height:1.45;margin:20rpx 0 10rpx;',
  h5: 'font-size:30rpx;font-weight:600;color:#374151;line-height:1.45;margin:18rpx 0 10rpx;',
  h6: 'font-size:28rpx;font-weight:600;color:#6b7280;line-height:1.45;margin:16rpx 0 8rpx;',
  p: 'font-size:30rpx;line-height:1.8;color:#374151;margin:16rpx 0;',
  ul: 'padding-left:40rpx;margin:16rpx 0;font-size:30rpx;line-height:1.8;color:#374151;',
  ol: 'padding-left:40rpx;margin:16rpx 0;font-size:30rpx;line-height:1.8;color:#374151;',
  li: 'font-size:30rpx;line-height:1.8;color:#374151;margin:6rpx 0;',
  blockquote:
    'margin:16rpx 0;padding:12rpx 20rpx;border-left:6rpx solid #ff4500;background:#fff7f4;color:#6b7280;font-size:28rpx;line-height:1.7;',
  hr: 'height:2rpx;background:#eceff3;border:none;margin:28rpx 0;',
  a: 'color:#ff4500;text-decoration:underline;',
  strong: 'font-weight:700;color:#111827;',
  em: 'font-style:italic;color:#4b5563;',
  table: 'width:100%;border-collapse:collapse;margin:16rpx 0;font-size:28rpx;',
  th: 'border:2rpx solid #e5e7eb;padding:10rpx 14rpx;background:#f9fafb;font-weight:600;text-align:left;',
  td: 'border:2rpx solid #e5e7eb;padding:10rpx 14rpx;',
  img: 'max-width:100%;height:auto;border-radius:8rpx;',
  pre: 'padding:20rpx;background:#f6f8fa;border:2rpx solid #e5e7eb;border-radius:8rpx;margin:16rpx 0;white-space:pre-wrap;word-break:break-all;',
  preCode:
    'font-family:Consolas,Monaco,monospace;font-size:26rpx;background:transparent;color:#24292e;padding:0;',
  code: 'font-family:Consolas,Monaco,monospace;font-size:26rpx;background:#f2f4f7;color:#c7254e;padding:2rpx 8rpx;border-radius:4rpx;',
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
    'p', 'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'strong', 'em', 'table', 'th', 'td', 'img',
  ]
  for (const tag of styledTags) {
    const re = new RegExp('<' + tag + '(\\s[^>]*)?>', 'g')
    html = html.replace(re, (whole, attrs?: string) =>
      `<${tag}${attrs || ''} style="${MD_STYLE[tag]}">`,
    )
  }

  // 最后把 highlight.js 的类名翻译成内联颜色
  html = inlineHljsTokens(html)

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
    formData.content = res.content
    formData.description = res.description
    formData.knowledge_base_id = res.knowledge_base_id

    // 记录编辑模式的初始值
    initialFormData.value = {
      name: res.name,
      content: res.content,
    }

    renderedContent.value = await renderMarkdown(formData.content)
  } catch (error) {
    console.error('加载文章详情失败：', error)
    uni.showToast({ title: '加载详情失败', icon: 'none' })
  }
}

/**
 * 手动校验表单（兼容uni-forms的校验逻辑）
 */
const validateForm = async (): Promise<boolean> => {
  try {
    // 方案1：使用formRef.validate（优先）
    if (formRef.value) {
      await formRef.value.validate(['name', 'content'])
      return true
    }

    // 方案2：手动校验（兜底）
    if (!formData.name.trim()) {
      uni.showToast({ title: '文章名称不能为空', icon: 'none' })
      return false
    }
    if (!formData.content.trim()) {
      uni.showToast({ title: '文章内容不能为空', icon: 'none' })
      return false
    }
    return true
  } catch (error: any) {
    console.error('表单校验失败：', error)
    uni.showToast({ title: error.errorMessage || '表单校验失败', icon: 'none' })
    return false
  }
}

/**
 * 按钮点击入口（新增日志）
 */
const handleBtnClick = async () => {
  // 先校验表单
  const isValid = await validateForm()
  if (!isValid) {
    return
  }

  // 执行提交逻辑
  await submit()
}

/**
 * 提交表单（直接使用接口文件的add/update方法）
 */
const submit = async (isFromBack?: boolean) => {
  try {
    if (type.value === 'edit') {
      // 编辑模式：调用updateKnowledgeNode（内置creator/knowledge_base处理）
      const res = await updateKnowledgeNode(formData.id, {
        name: formData.name,
        content: formData.content,
        description: formData.description,
        knowledge_base_id: formData.knowledge_base_id,
      })
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      // 新增模式：调用addKnowledgeNode（内置creator/knowledge_base处理）
      const res = await addKnowledgeNode({
        name: formData.name,
        content: formData.content,
        description: formData.description,
        knowledge_base_id: formData.knowledge_base_id,
      })
      uni.showToast({ title: '新增成功', icon: 'success' })
    }

    // 更新初始值（避免返回时重复提示）
    initialFormData.value = {
      name: formData.name,
      content: formData.content,
    }

    // 如果是返回时的保存操作，保存成功后执行返回
    if (isFromBack) {
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    }
  } catch (error: any) {
    // 接口文件已内置loading和错误提示，此处仅兜底
    const errorMsg = error.message || '操作失败，请重试'
    console.error('提交文章失败：', error)
    uni.showToast({ title: errorMsg, icon: 'none' })
  }
}

/**
 * 拦截返回事件：有修改则提示是否保存
 */
onBackPress((options) => {
  // 只拦截小程序原生返回（非navigateBack调用）
  if (options.from !== 'backbutton') return false

  // 无修改则直接返回
  if (!hasFormChanged.value) return false

  // 有修改则弹出确认框
  uni.showModal({
    title: '提示',
    content: '您有未保存的修改，是否保存后返回？',
    confirmText: '是',
    cancelText: '否',
    success: (res) => {
      if (res.confirm) {
        // 点击“是”：保存后返回
        handleBtnClick() // 改用handleBtnClick，统一校验逻辑
      } else if (res.cancel) {
        // 点击“否”：直接返回（放弃修改）
        uni.navigateBack()
      }
    },
  })

  // 返回true表示拦截默认返回行为
  return true
})

// ========== 生命周期 ==========
onLoad((options: any) => {
  type.value = options.type || 'edit'
  kbId.value = options.kbId || ''

  // 初始化初始值（新增模式）
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

onReady(async () => {
  // 关键修改2：在onReady后通过nextTick延迟获取formRef
  await nextTick()

  // 兼容小程序：通过getCurrentInstance获取组件实例
  if (instance && instance.refs) {
    formRef.value = instance.refs.formRef as UniFormsInstance
  }

  await renderMarkdownAsync()
})
</script>

<style scoped lang="scss">
// 基础样式：规范嵌套+兼容小程序
page {
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  // 注意：这里不能写 height:100% + overflow:hidden。
  // 那会让内容超过一屏时既被裁掉、又完全滚不动（小屏手机上编辑区直接看不到）。
}

.node-detail-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  position: relative;
}

// 主内容容器：仅做布局承载，不锁死高度
.content-container {
  flex: 1;
  padding: 15px;
  padding-right: env(safe-area-inset-right) !important;
  padding-left: env(safe-area-inset-left) !important;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

// 表单容器
.form-container {
  background-color: #fff;
  padding: 20px 15px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  width: 100%;
  box-sizing: border-box;
  position: relative;
  z-index: 2;
  // height 交给内容：内容多高就多高，超出屏幕的部分由页面滚动来展示
}

.form-item {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 20px;
}

// 文章名称输入样式：适配同行保存按钮
.name-item {
  .uni-forms-item__label {
    font-size: 15px;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 10px;
    display: block;
  }

  .name-input-wrapper {
    display: flex;
    align-items: center;
    background-color: #f8f9fa;
    border-radius: 8px;
    padding: 0 12px;
    border: 1px solid #e9ecef;
    transition: all 0.3s ease;
    gap: 8px;

    .name-input {
      flex: 1; // 输入框占满剩余空间
      height: 48px;
      padding: 0 8px;
      border: none;
      background: transparent;
      font-size: 15px;
      color: #2c3e50;
      outline: none;
      box-sizing: border-box;
      max-width: none;

      &::placeholder {
        color: #adb5bd;
        font-size: 14px;
      }

      &:focus {
        background-color: #fff;
      }
    }

    .name-input-icon {
      font-size: 18px;
      margin-right: 4px;
      color: #e03c00;
      flex-shrink: 0;
    }

    // 保存按钮样式：适配行内显示
    .save-btn {
      flex-shrink: 0; // 固定宽度不收缩
      width: 100px;
      height: 36px;
      line-height: 36px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      background-color: #e03c00;
      color: #fff;
      padding: 0;
      margin: 0;

      &:active {
        background-color: #b33000;
      }

      &[disabled] {
        background-color: #ccc;
        color: #fff;
        cursor: not-allowed;
      }
    }
  }
}

// 内容编辑区样式（双独立滚动）
.content-item {
  & > view {
    width: 100%;
    box-sizing: border-box;
  }

  .content-section-title {
    font-size: 14px;
    font-weight: 600;
    color: #495057;
    margin: 15px 0 10px;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 14px;
      background-color: #e03c00;
      margin-right: 6px;
      border-radius: 2px;
    }
  }

  // 预览区样式
  .preview-wrapper {
    width: 100%;
    height: 250px;
    margin-bottom: 20px;
    border-radius: 10px;
    border: 1px solid #dee2e6;
    overflow: hidden !important;
    box-sizing: border-box;
    position: relative;
    z-index: 3;
  }

  .preview-scroll {
    width: 100%;
    height: 100%;
    background-color: #f8f9fa;
    padding: 15px;
    box-sizing: border-box;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    position: relative;
    z-index: 4;

    // 预览区滚动条（仅内部生效，不影响全局）
    &::-webkit-scrollbar {
      width: 6px;
      margin-right: 2px;
    }

    &::-webkit-scrollbar-track {
      background: #e9ecef;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: #adb5bd;
      border-radius: 3px;

      &:hover {
        background: #868e96;
      }
    }
  }

  // 编辑区样式
  .editor-wrapper {
    width: 100%;
    height: 400px; // 适度加高，适配无限制输入
    border-radius: 10px;
    border: 1px solid #dee2e6;
    overflow: hidden !important;
    box-sizing: border-box;
    position: relative;
    z-index: 3;
    touch-action: pan-y;
  }

  .editor-scroll {
    width: 100%;
    height: 100%;
    background-color: #fff;
    box-sizing: border-box;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    position: relative;
    z-index: 4;
    touch-action: pan-y;

    // 编辑区滚动条（仅内部生效，不影响全局）
    &::-webkit-scrollbar {
      width: 6px;
      margin-right: 2px;
    }

    &::-webkit-scrollbar-track {
      background: #f8f9fa;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: #e03c00;
      border-radius: 3px;

      &:hover {
        background: #b33000;
      }
    }

    // 编辑框样式：彻底移除字数限制
    .content-textarea {
      width: 100%;
      height: 100% !important;
      padding: 15px;
      border: none;
      background-color: transparent;
      font-size: 15px;
      line-height: 1.6;
      resize: none !important;
      box-sizing: border-box;
      outline: none;
      color: #2c3e50;
      overflow: hidden !important;
      max-height: none !important;

      &::placeholder {
        color: #adb5bd;
        font-size: 14px;
      }

      &:focus {
        box-shadow: 0 0 0 3px rgba(224, 60, 0, 0.1);
      }
    }
  }
}

// Markdown渲染样式
.detail-content {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  margin-bottom: 0;
}

.markdown-body {
  width: 100%;
  box-sizing: border-box;
  line-height: 1.8;
  font-size: 14px;
  color: #333;
}

.md-h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 20px 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.md-h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 18px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #eee;
}

.md-h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 6px;
}

.md-h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 14px 0 6px;
}

.md-h5 {
  font-size: 14px;
  font-weight: 600;
  margin: 12px 0 4px;
}

.md-h6 {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  margin: 12px 0 4px;
}

.md-p {
  margin: 10px 0;
  text-align: justify;
}

.md-ul {
  margin: 10px 0;
  padding-left: 20px;
}

.md-ol {
  margin: 10px 0;
  padding-left: 20px;
}

.md-em {
  font-style: italic;
  color: #666;
}

.md-pre {
  margin: 15px 0;
  overflow-x: auto;
}

.md-code {
  padding: 2px 4px;
  border-radius: 4px;
  background-color: #f5f5f5;
  color: #e53935;
}

// 代码高亮样式穿透（规范写法）
::v-deep .markdown-body .hljs {
  padding: 0;
  background: transparent;
  line-height: 1.5;
  font-size: 13px;
  font-family: Consolas, Monaco, monospace;
}
</style>
