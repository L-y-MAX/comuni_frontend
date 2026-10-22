<template>
  <view class="rich-editor">
    <!-- 工具栏：先选中文字，再点按钮；不需要记住任何 Markdown 语法 -->
    <scroll-view
      v-if="!fallback"
      class="re-toolbar"
      scroll-x
      :show-scrollbar="false"
    >
      <view class="re-tools">
        <text
          class="re-btn bold"
          :class="{ on: active.bold }"
          @click="fmt('bold')"
        >
          B
        </text>
        <text
          class="re-btn italic"
          :class="{ on: active.italic }"
          @click="fmt('italic')"
        >
          I
        </text>
        <text
          class="re-btn underline"
          :class="{ on: active.underline }"
          @click="fmt('underline')"
        >
          U
        </text>

        <view class="re-sep" />

        <text
          v-for="s in SIZES"
          :key="s.value"
          class="re-btn size"
          :class="{ on: active.fontSize === s.value }"
          @click="setSize(s.value)"
        >
          {{ s.label }}
        </text>

        <view class="re-sep" />

        <text
          class="re-btn"
          @click="fmt('header', 'H2')"
        >
          标题
        </text>
        <text
          class="re-btn"
          @click="fmt('list', 'bullet')"
        >
          · 列表
        </text>
        <text
          class="re-btn"
          @click="undo"
        >
          撤销
        </text>
        <text
          class="re-btn"
          @click="clearFormat"
        >
          清格式
        </text>
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
      <text class="re-fallback-tip">
        当前环境无法加载富文本编辑器，已切换为纯文本模式（仍可正常保存）
      </text>
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
import { getCurrentInstance, onMounted, ref, watch } from 'vue'

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
  },
)

const emit = defineEmits<{
  (e: 'update:html', v: string): void
  (e: 'change'): void
}>()

// 微信 editor 的 format('fontSize') 只接受固定合法值：
// 12px / 14px / 16px / 18px / 20px / 22px / 24px。
// 原「标准」用了 17px（非法值）会被静默忽略，表现为"点了字号没反应"。
const SIZES = [
  { label: '小字', value: '14px' },
  { label: '标准', value: '16px' },
  { label: '大字', value: '20px' },
  { label: '特大', value: '24px' },
]

const instance = getCurrentInstance()
/**
 * EditorContext 必须用**普通变量**持有，不能放进 ref/reactive：
 * 微信端的视图数据要做结构化克隆，原生 context 对象不可克隆，
 * 放进响应式状态会在每次 publish/ready 时报 "An object could not be cloned"。
 */
let editorCtx: any = null
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
 * 微信端这一步很容易拿不到，历史上踩过两个坑：
 *  1. `.in()` 传的对象不对（vue3 下要把 mp 的原生组件实例传进去，而不是 vue proxy），
 *     传错时 select() 什么都查不到，回调里 res.context 为 undefined；
 *  2. @ready 触发时机偶尔早于节点可查询，需要重试。
 * 所以这里做成：候选实例依次试 + 每轮多时点重试，全都失败才降级为纯文本。
 */
const acquire = (round = 0) => {
  if (ready.value || fallback.value) return
  const self: any = instance?.proxy ?? instance
  const candidates = [self?.$scope, self, instance, null].filter(
    (c, i, arr) => arr.indexOf(c) === i,
  )

  let pending = candidates.length
  let got = false

  const finish = () => {
    pending -= 1
    if (got || pending > 0) return
    // 本轮全部失败
    if (round < 6) {
      setTimeout(() => acquire(round + 1), 250)
    } else {
      enableFallback()
    }
  }

  candidates.forEach((cand) => {
    try {
      const hasUni = typeof uni !== 'undefined' && typeof uni.createSelectorQuery === 'function'
      const hasWx =
        typeof wx !== 'undefined' && typeof (wx as any).createSelectorQuery === 'function'
      if (!hasUni && !hasWx) {
        finish()
        return
      }
      const query: any = hasUni ? uni.createSelectorQuery() : (wx as any).createSelectorQuery()
      if (cand && typeof query.in === 'function') query.in(cand)
      const node = query.select('#rich-editor')
      if (!node || typeof node.context !== 'function') {
        finish()
        return
      }
      node
        .context((res: any) => {
          const context = res?.context || null
          if (!got && context) {
            got = true
            editorCtx = context
            ready.value = true
            if (fallbackTimer) {
              clearTimeout(fallbackTimer)
              fallbackTimer = null
            }
            if (props.html) context.setContents({ html: props.html })
          }
          finish()
        })
        .exec()
    } catch (err) {
      console.warn('[RichEditor] 查询编辑器上下文异常：', err)
      finish()
    }
  })
}

const onReady = () => acquire(0)

onMounted(() => {
  // @ready 在部分版本里不触发，挂载后主动再取一次
  setTimeout(() => acquire(0), 300)
  // 总兜底：3 秒内既没拿到上下文也没降级，就降级成纯文本，避免出现点了没反应的死按钮
  setTimeout(() => {
    if (!ready.value && !fallback.value) enableFallback()
  }, 3000)
})

const onInput = (e: any) => {
  // 用户自己敲的内容，回灌会打断光标，所以标记一下
  internalChange = true
  emit('update:html', e?.detail?.html ?? '')
  emit('change')
}

/** 工具栏高亮跟着光标所在位置同步（只取简单字段，复杂对象不进响应式状态） */
const onStatusChange = (e: any) => {
  const d = e?.detail || {}
  active.value = {
    bold: !!d.bold,
    italic: !!d.italic,
    underline: !!d.underline,
    fontSize: typeof d.fontSize === 'string' ? d.fontSize : '',
  }
}

/** 未就绪时点击工具按钮给出提示，避免"点了没反应"的困惑 */
const needCtx = (): any => {
  if (editorCtx) return editorCtx
  uni.showToast({ title: '编辑器还没就绪，请稍等再试', icon: 'none', duration: 1500 })
  return null
}

const fmt = (name: string, value?: string) => needCtx()?.format(name, value)
const setSize = (value: string) => fmt('fontSize', value)
const undo = () => needCtx()?.undo()
const clearFormat = () => needCtx()?.removeFormat()

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
      fallbackText.value = String(value)
        .replace(/<[^>]+>/g, '')
        .trim()
      return
    }
    if (!ready.value || !editorCtx) return
    editorCtx.setContents({ html: value || '' })
  },
)

defineExpose({
  setHtml: (html: string) => editorCtx?.setContents({ html }),
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
