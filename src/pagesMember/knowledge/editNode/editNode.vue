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
import hljs from 'highlight.js'
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
  const language = hljs.getLanguage(lang) ? lang : 'plaintext'
  return hljs.highlight(code, { language }).value
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
  console.log('按钮禁用状态计算：', {
    disabled,
    name: formData.name.trim(),
    content: formData.content.trim(),
    nameEmpty: !formData.name.trim(),
    contentEmpty: !formData.content.trim(),
  })
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
  stopPageScroll()
}

/**
 * 阻止页面滚动
 */
const stopPageScroll = () => {
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
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
const renderMarkdown = async (content: string): Promise<string> => {
  if (!content) return ''

  const tocItems = extractToc(content)
  const titleMap = new Map(tocItems.map((item) => [item.title, item.id]))

  let html = await marked.parse(content)
  html = `<div class="markdown-body">${html}</div>`

  // 替换标题样式+添加锚点ID
  html = html
    .replace(/<h1>(.*?)<\/h1>/g, (_, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h1-${Date.now()}`
      return `<h1 id="${id}" class="md-h1">${title}</h1>`
    })
    .replace(/<h2>(.*?)<\/h2>/g, (_, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h2-${Date.now()}`
      return `<h2 id="${id}" class="md-h2">${title}</h2>`
    })
    .replace(/<h3>(.*?)<\/h3>/g, (_, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h3-${Date.now()}`
      return `<h3 id="${id}" class="md-h3">${title}</h3>`
    })
    .replace(/<h4>(.*?)<\/h4>/g, (_, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h4-${Date.now()}`
      return `<h4 id="${id}" class="md-h4">${title}</h4>`
    })
    .replace(/<h5>(.*?)<\/h5>/g, (_, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h5-${Date.now()}`
      return `<h5 id="${id}" class="md-h5">${title}</h5>`
    })
    .replace(/<h6>(.*?)<\/h6>/g, (_, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h6-${Date.now()}`
      return `<h6 id="${id}" class="md-h6">${title}</h6>`
    })
    .replace(/<p>/g, '<p class="md-p">')
    .replace(/<ul>/g, '<ul class="md-ul">')
    .replace(/<ol>/g, '<ol class="md-ol">')
    .replace(/<em>/g, '<em class="md-em">')
    .replace(
      /<pre>/g,
      '<pre class="md-pre" style="padding: 20rpx; background: #f7fafc; border-radius: 8rpx; overflow-x: auto;">',
    )
    .replace(
      /<code>/g,
      '<code class="md-code" style="font-family: Consolas, Monaco, monospace; font-size: 28rpx;">',
    )

  return html
}

/**
 * 同步编辑内容并渲染Markdown
 */
const handleContentInputSync = () => {
  renderMarkdownAsync()
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

  console.log('页面初始化完成，当前状态：', {
    type: type.value,
    kbId: kbId.value,
    formData: { ...formData },
  })
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
  height: 100%;
  box-sizing: border-box;
  overflow: hidden; // 彻底禁用页面级滚动
}

.node-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  position: relative;
  overflow: hidden; // 禁用容器滚动
}

// 主内容容器：移除滚动属性，仅做布局承载
.content-container {
  flex: 1;
  padding: 15px;
  padding-right: env(safe-area-inset-right) !important;
  padding-left: env(safe-area-inset-left) !important;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  overflow: hidden; // 确保无滚动轴
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
  height: 100%; // 占满父容器，避免溢出
  overflow: hidden; // 禁用表单容器滚动
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
      color: #007aff;
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
      background-color: #007aff;
      color: #fff;
      padding: 0;
      margin: 0;

      &:active {
        background-color: #0066cc;
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
      background-color: #007aff;
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
      background: #007aff;
      border-radius: 3px;

      &:hover {
        background: #0066cc;
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
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
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
