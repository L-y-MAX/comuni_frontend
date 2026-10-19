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
      id="rich-editor"
      class="re-body"
      :placeholder="placeholder"
      :maxlength="maxlength"
      @ready="onReady"
      @input="onInput"
      @statuschange="onStatusChange"
    />
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

/** 拿 EditorContext：必须先等 ready，否则 select 拿不到组件实例 */
const onReady = () => {
  const query = uni.createSelectorQuery().in(instance?.proxy as any)
  query
    .select('#rich-editor')
    .context((res: any) => {
      ctx.value = res?.context || null
      ready.value = true
    })
    .exec()
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
    if (!ready.value || !ctx.value || value === undefined || value === null) return
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
</style>
