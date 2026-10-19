<template>
  <view class="rich-editor">
    <!-- 工具栏：先选中文字，再点按钮；不需要记住任何 Markdown 语法 -->
    <scroll-view
      class="re-toolbar"
      scroll-x
      :show-scrollbar="false"
    >
      <view class="re-tools">
        <text
          class="re-btn bold"
          :class="{ on: active.bold }"
          @click="fmt('bold')"
        >B</text>
        <text
          class="re-btn italic"
          :class="{ on: active.italic }"
          @click="fmt('italic')"
        >I</text>
        <text
          class="re-btn underline"
          :class="{ on: active.underline }"
          @click="fmt('underline')"
        >U</text>

        <view class="re-sep" />

        <text
          v-for="s in SIZES"
          :key="s.value"
          class="re-btn size"
          :class="{ on: active.fontSize === s.value }"
          @click="setSize(s.value)"
        >{{ s.label }}</text>

        <view class="re-sep" />

        <text class="re-btn" @click="fmt('header', 'H2')">标题</text>
        <text class="re-btn" @click="fmt('list', 'bullet')">· 列表</text>
        <text class="re-btn" @click="undo">撤销</text>
        <text class="re-btn" @click="clearFormat">清格式</text>
      </view>
    </scroll-view>

    <editor
      v-if="!fallback"
      id="rich-editor"
      class="re-body"
      :placeholder="placeholder"
      :maxlength="maxlength"
      @ready="onReady"
      @input="onInput"
      @statuschange="onStatusChange"
    />

    <!-- 兜底：拿不到编辑器上下文时降级成纯文本框，至少能正常写和存 -->
    <view
      v-else
      class="re-fallback"
    >
      <text class="re-fallback-tip">当前环境无法加载富文本编辑器，已切换为纯文本模式（仍可正常保存）</text>
      <textarea
        class="re-fallback-input"
        :value="fallbackText"
        :maxlength="maxlength"
        :placeholder="placeholder"
        @input="onFallbackInput"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 知识库富文本编辑器
 *
 * 为什么用小程序原生 <editor> 而不是 textarea：
 * textarea 没有选区 API，做不到"选中文字→加粗/改字号"；而 Markdown 方案要求用户
 * 会写语法，大部分人不会。editor 是所见即所得的富文本，产出 HTML 存在 content 字段，
 * 展示端 showNode 用 marked 渲染时会原样透传 HTML，无需改动。
 */
import { getCurrentInstance, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    html?: string
    placeholder?: string
    maxlength?: number
  }>(),
  {
    html: '',
    placeholder: '在这里写正文：选中文字后点上方按钮即可加粗、调字号',
    maxlength: 500000,
  }
)

const emit = defineEmits<{
  (e: 'update:html', v: string): void
  (e: 'change'): void
}>()

const SIZES = [
  { label: '小字', value: '14px' },
  { label: '标准', value: '17px' },
  { label: '大字', value: '20px' },
  { label: '特大', value: '24px' },
]

const instance = getCurrentInstance()
const ctx = ref<any>(null)
const ready = ref(false)
const active = ref<Record<string, any>>({})
/** 本次变更是否来自用户输入（用于跳过回灌） */
let internalChange = false

/** 富文本不可用时的降级状态 */
const fallback = ref(false)
const fallbackText = ref('')
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

/** 降级：把 HTML 粗略还原成纯文本，保证内容不丢，页面照常可写可存 */
const enableFallback = () => {
  if (fallback.value) return
  fallback.value = true
  const plain = String(props.html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  fallbackText.value = plain
  console.warn('[RichEditor] 富文本编辑器不可用，已降级为纯文本模式')
}

const onFallbackInput = (e: any) => {
  const value = e?.detail?.value ?? ''
  fallbackText.value = value
  internalChange = true
  emit('update:html', value)
  emit('change')
}

/**
 * 取 EditorContext。
 *
 * 这里是微信端最容易出问题的地方，全部加固：
 *  1. createSelectorQuery / in() / select() 任一步可能因为时机或环境差异拿不到东西，
 *     直接 .context 会抛 "Cannot read property context of null"，所以先判空再调；
 *  2. 节点还没渲染好时自动重试几次，而不是一次失败就永久不可编辑；
 *  3. uni 查询不可用时退回 wx.createSelectorQuery。
 */
const onReady = () => {
  // 兜底计时器：@ready 触发了但始终拿不到上下文，也要能正常写文章
  if (!fallbackTimer) {
    fallbackTimer = setTimeout(() => {
      if (!ready.value) enableFallback()
    }, 1500)
  }

  const grab = (attempt = 0) => {
    try {
      const self = (instance?.proxy ?? instance) as any
      const hasUni = typeof uni !== 'undefined' && typeof uni.createSelectorQuery === 'function'
      const hasWx = typeof wx !== 'undefined' && typeof (wx as any).createSelectorQuery === 'function'
      if (!hasUni && !hasWx) {
        enableFallback()
        return
      }
      const query: any = hasUni ? uni.createSelectorQuery() : (wx as any).createSelectorQuery()
      if (self && typeof query.in === 'function') query.in(self)
      const node = query.select('#rich-editor')
      if (!node || typeof node.context !== 'function') {
        if (attempt < 3) return void setTimeout(() => grab(attempt + 1), 120)
        enableFallback()
        return
      }
      node
        .context((res: any) => {
          ctx.value = res?.context || null
          if (!ctx.value) {
            enableFallback()
            return
          }
          ready.value = true
          if (fallbackTimer) {
            clearTimeout(fallbackTimer)
            fallbackTimer = null
          }
          if (props.html) ctx.value.setContents({ html: props.html })
        })
        .exec()
    } catch (err) {
      console.error('[RichEditor] 获取编辑器上下文失败：', err)
      if (attempt < 3) setTimeout(() => grab(attempt + 1), 120)
      else enableFallback()
    }
  }
  grab()
}

const onInput = (e: any) => {
  // 用户自己敲的内容，回灌会打断光标，所以标记一下
  internalChange = true
  emit('update:html', e?.detail?.html ?? '')
  emit('change')
}

/** 工具栏高亮跟着光标所在位置同步 */
const onStatusChange = (e: any) => {
  active.value = e?.detail ?? {}
}

const fmt = (name: string, value?: string) => ctx.value?.format(name, value)
const setSize = (value: string) => fmt('fontSize', value)
const undo = () => ctx.value?.undo()
const clearFormat = () => ctx.value?.removeFormat()

/**
 * 外部赋值（填充示例、加载已有文章）要同步进编辑器；
 * 用户自己输入引起的变更必须跳过，否则会打断光标、丢失输入。
 */
watch(
  () => props.html,
  (value) => {
    if (internalChange) {
      internalChange = false
      return
    }
    if (value === undefined || value === null) return
    if (fallback.value) {
      fallbackText.value = String(value).replace(/<[^>]+>/g, '').trim()
      return
    }
    if (!ready.value || !ctx.value) return
    ctx.value.setContents({ html: value || '' })
  }
)

defineExpose({
  setHtml: (html: string) => ctx.value?.setContents({ html }),
})
</script>

<style scoped lang="scss">
.rich-editor {
  width: 100%;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  background: #ffffff;
  overflow: hidden;
}

.re-toolbar {
  width: 100%;
  background: #f8fafc;
  border-bottom: 1rpx solid #e5e7eb;
  white-space: nowrap;
}

.re-tools {
  display: flex;
  align-items: center;
  padding: 12rpx 14rpx;
}

.re-btn {
  flex: none;
  min-width: 64rpx;
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  padding: 0 16rpx;
  margin-right: 10rpx;
  border-radius: 10rpx;
  font-size: 26rpx;
  color: #334155;
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
}

.re-btn.on {
  color: #ffffff;
  background: #2563eb;
  border-color: #2563eb;
}

.re-btn.bold {
  font-weight: 700;
}

.re-btn.italic {
  font-style: italic;
}

.re-btn.underline {
  text-decoration: underline;
}

.re-btn.size {
  font-size: 24rpx;
}

.re-sep {
  flex: none;
  width: 1rpx;
  height: 36rpx;
  background: #e2e8f0;
  margin: 0 12rpx 0 2rpx;
}

/* 小程序 editor 需要明确高度，否则不显示内容区 */
.re-body {
  width: 100%;
  height: 560rpx;
  box-sizing: border-box;
  padding: 20rpx 22rpx;
  font-size: 30rpx;
  line-height: 1.7;
  color: #333333;
}

/* 降级模式 */
.re-fallback {
  padding: 16rpx 18rpx;
}

.re-fallback-tip {
  display: block;
  font-size: 22rpx;
  color: #b45309;
  background: #fffbeb;
  border: 1rpx solid #fde68a;
  border-radius: 8rpx;
  padding: 10rpx 14rpx;
  margin-bottom: 12rpx;
  line-height: 1.5;
}

.re-fallback-input {
  width: 100%;
  height: 480rpx;
  box-sizing: border-box;
  padding: 18rpx 20rpx;
  font-size: 30rpx;
  line-height: 1.7;
  color: #333333;
  background: #ffffff;
}
</style>
