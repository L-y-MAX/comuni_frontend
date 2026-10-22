<template>
  <view class="rich-editor">
    <!--
      工具栏：作用于「选中的文字」（拿不到选区时退化为在光标处插入标记）。
      为什么不再用组件 <editor>：
      editor 的 format() 执行一次后会清空选区，导致「加粗后再调字号」第二次点没有作用对象，
      且 EditorContext 没有提供恢复选区的 API。改为 textarea 编辑 + 标记插入 + 预览渲染，
      选区由 wx.getSelectedTextRange 维护，可以连续应用多种格式。
    -->
    <scroll-view
      class="re-toolbar"
      scroll-x
      :show-scrollbar="false"
    >
      <view class="re-tools">
        <text
          class="re-btn bold"
          @click="apply('bold')"
        >
          B
        </text>
        <text
          class="re-btn italic"
          @click="apply('italic')"
        >
          I
        </text>
        <text
          class="re-btn underline"
          @click="apply('underline')"
        >
          U
        </text>

        <view class="re-sep" />

        <text
          v-for="s in SIZES"
          :key="s.value"
          class="re-btn size"
          @click="apply('size', s.value)"
        >
          {{ s.label }}
        </text>

        <view class="re-sep" />

        <text
          class="re-btn"
          @click="apply('h2')"
        >
          标题
        </text>
        <text
          class="re-btn"
          @click="apply('list')"
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
          @click="apply('clear')"
        >
          清格式
        </text>
      </view>
    </scroll-view>

    <textarea
      v-model="innerValue"
      class="re-textarea"
      :maxlength="maxlength"
      :cursor="cursor"
      :selection-start="selStart"
      :selection-end="selEnd"
      :show-confirm-bar="false"
      :auto-height="false"
      :adjust-position="true"
      :disable-default-padding="true"
      :placeholder="placeholder || '在这里写正文：可选中文字后点按钮加粗、调字号；也支持直接写 Markdown'"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
    <view class="re-tip">
      <text class="re-tip-text">
        提示：选中文字后点按钮可加粗/调字号；直接输入 Markdown 也可（**加粗**、## 标题、- 列表）
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    html?: string;
    maxlength?: number;
    placeholder?: string;
  }>(),
  {
    html: '',
    maxlength: -1,
    placeholder: '',
  }
);

const emit = defineEmits<{
  (e: 'update:html', v: string): void;
  (e: 'change'): void;
}>();

// 微信 editor 的 format('fontSize') 只接受合法值（12/14/16/18/20/22/24px），
// 这里字号依然限制在这个集合内（16px 作为「标准」）。
const SIZES = [
  { label: '小字', value: '14px' },
  { label: '标准', value: '16px' },
  { label: '大字', value: '20px' },
  { label: '特大', value: '24px' },
];

const innerValue = ref('');
/** 光标位置（textarea 的 cursor 属性），-1 表示不强制 */
let cursorPos = -1;
const cursor = ref(-1);
/** 选区（受控属性），用于插入后把光标放回合适位置 */
const selStart = ref(0);
const selEnd = ref(0);

/** 选区是否有效（由 wx.getSelectedTextRange 获取） */
let lastRange = { start: 0, end: 0 };

/** 撤销栈 */
interface Snapshot {
  value: string;
  cursor: number;
}
const history: Snapshot[] = [];
const HISTORY_MAX = 50;

const pushHistory = () => {
  if (history.length >= HISTORY_MAX) history.shift();
  history.push({ value: innerValue.value, cursor: cursorPos });
};

const emitChange = () => {
  emit('update:html', innerValue.value);
  emit('change');
};

const onInput = (e: any) => {
  const value = String(e?.detail?.value ?? '');
  const pos = e?.detail?.cursor;
  innerValue.value = value;
  if (typeof pos === 'number') cursorPos = pos;
  pushHistory();
  emitChange();
};

const onFocus = () => {
  // 聚焦时把上次记录的光标位置恢复（受控 cursor 属性）
  if (cursorPos >= 0) {
    cursor.value = cursorPos;
    selStart.value = cursorPos;
    selEnd.value = cursorPos;
  }
};

const onBlur = () => {
  cursor.value = -1; // 释放受控，避免下次聚焦被强制定位
};

/** 读取当前选区（textarea 需处于聚焦态） */
const readSelection = (): Promise<{ start: number; end: number }> => {
  return new Promise((resolve) => {
    const api = (uni as any).getSelectedTextRange;
    if (typeof api !== 'function') {
      resolve({ start: lastRange.start, end: lastRange.end });
      return;
    }
    api({
      success: (res: any) => {
        const start = Number(res?.start) || 0;
        const end = Number(res?.end) || 0;
        lastRange = { start, end };
        resolve({ start, end });
      },
      fail: () => resolve({ start: lastRange.start, end: lastRange.end }),
    });
  });
};

/** 在选区两端包裹标记；没有选区时在光标处插入一对空标记并把光标放中间 */
const wrapSelection = (before: string, after: string) => {
  const value = innerValue.value;
  const start = Math.max(0, Math.min(lastRange.start, value.length));
  const end = Math.max(start, Math.min(lastRange.end, value.length));
  const selected = value.slice(start, end);

  if (start === end) {
    // 无选区：插入空标记对，光标定位到中间，用户接着输入即可
    const insert = before + after;
    innerValue.value = value.slice(0, start) + insert + value.slice(end);
    const caret = start + before.length;
    cursorPos = caret;
    selStart.value = caret;
    selEnd.value = caret;
    cursor.value = caret;
    pushHistory();
    emitChange();
    return;
  }

  innerValue.value = value.slice(0, start) + before + selected + after + value.slice(end);
  const caret = start + before.length + selected.length + after.length;
  cursorPos = caret;
  selStart.value = caret;
  selEnd.value = caret;
  cursor.value = caret;
  pushHistory();
  emitChange();
};

/** 在选区每行行首加前缀（标题/列表） */
const prefixLines = (prefix: string) => {
  const value = innerValue.value;
  const start = Math.max(0, Math.min(lastRange.start, value.length));
  const end = Math.max(start, Math.min(lastRange.end, value.length));

  if (start === end) {
    // 无选区：在当前行行首插入前缀
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    innerValue.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    const caret = start + prefix.length;
    cursorPos = caret;
    selStart.value = caret;
    selEnd.value = caret;
    cursor.value = caret;
    pushHistory();
    emitChange();
    return;
  }

  const block = value.slice(start, end);
  const replaced = block
    .split('\n')
    .map((line) => (line.length ? prefix + line : prefix.trimEnd()))
    .join('\n');
  innerValue.value = value.slice(0, start) + replaced + value.slice(end);
  const caret = start + replaced.length;
  cursorPos = caret;
  selStart.value = caret;
  selEnd.value = caret;
  cursor.value = caret;
  pushHistory();
  emitChange();
};

/** 去掉选区内的 Markdown/HTML 格式标记 */
const clearFormat = () => {
  const value = innerValue.value;
  const start = Math.max(0, Math.min(lastRange.start, value.length));
  const end = Math.max(start, Math.min(lastRange.end, value.length));
  const block = value.slice(start, end);
  const plain = block
    .replace(/<span[^>]*style="font-size:[^"]*"[^>]*>(.*?)<\/span>/gis, '$1')
    .replace(/<\/?(strong|b|em|i|u|span)[^>]*>/gi, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '');
  innerValue.value = value.slice(0, start) + plain + value.slice(end);
  const caret = start + plain.length;
  cursorPos = caret;
  selStart.value = caret;
  selEnd.value = caret;
  cursor.value = caret;
  pushHistory();
  emitChange();
};

/** 统一入口：type = bold/italic/underline/size/h2/list/clear */
const apply = (type: string, value = '') => {
  // 先尝试读取选区（textarea 失焦时可能拿不到，退化为光标位置）
  readSelection().then(({ start, end }) => {
    lastRange = { start, end };
    if (type === 'bold') wrapSelection('**', '**');
    else if (type === 'italic') wrapSelection('*', '*');
    else if (type === 'underline') wrapSelection('<u>', '</u>');
    else if (type === 'size') wrapSelection(`<span style="font-size:${value}">`, '</span>');
    else if (type === 'h2') prefixLines('## ');
    else if (type === 'list') prefixLines('- ');
    else if (type === 'clear') clearFormat();
  });
};

const undo = () => {
  const snap = history.pop();
  if (!snap) return;
  innerValue.value = snap.value;
  cursorPos = snap.cursor >= 0 ? snap.cursor : innerValue.value.length;
  selStart.value = cursorPos;
  selEnd.value = cursorPos;
  cursor.value = cursorPos;
  emitChange();
};

/**
 * 外部赋值（填充示例、加载已有文章）同步进输入框；
 * 旧文章内容可能是 HTML（editor 时代保存），这里转成 Markdown 风格以便继续编辑。
 */
const htmlToEditableText = (input: string): string => {
  const text = String(input || '');
  if (!/<[a-z][^>]*>/i.test(text)) return text;
  return text
    .replace(/<span[^>]*style="font-size:([^"]*)"[^>]*>([\s\S]*?)<\/span>/gi, (m, size, body) => body)
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_m, _t, body) => `**${body}**`)
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_m, _t, body) => `*${body}*`)
    .replace(/<u>([\s\S]*?)<\/u>/gi, (_m, body) => `<u>${body}</u>`)
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, body) => `${'#'.repeat(Number(level))} ${String(body).trim()}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, body) => `- ${String(body).trim()}\n`)
    .replace(/<\/?(ul|ol)[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

watch(
  () => props.html,
  (value) => {
    const next = htmlToEditableText(value || '');
    if (next === innerValue.value) return;
    innerValue.value = next;
    cursorPos = innerValue.value.length;
    selStart.value = cursorPos;
    selEnd.value = cursorPos;
  },
  { immediate: true }
);

defineExpose({
  setHtml: (html: string) => {
    innerValue.value = htmlToEditableText(html);
    cursorPos = innerValue.value.length;
    selStart.value = cursorPos;
    selEnd.value = cursorPos;
    emitChange();
  },
});
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
  padding: 10rpx 12rpx;
}

.re-btn {
  flex: 0 0 auto;
  padding: 0 18rpx;
  height: 56rpx;
  line-height: 56rpx;
  font-size: 26rpx;
  color: #333333;
  border-radius: 8rpx;
  background: transparent;

  &:active {
    background: #e2e8f0;
  }
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
  font-size: 22rpx;
  color: #475569;
}

.re-sep {
  flex: 0 0 auto;
  width: 1rpx;
  height: 32rpx;
  background: #e2e8f0;
  margin: 0 8rpx;
}

.re-textarea {
  width: 100%;
  height: 420rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  line-height: 1.7;
  color: #1f2937;
  background: #ffffff;
  box-sizing: border-box;
}

.re-tip {
  padding: 12rpx 16rpx 16rpx;
  background: #f8fafc;
  border-top: 1rpx solid #eef2f6;
}

.re-tip-text {
  font-size: 20rpx;
  color: #94a3b8;
  line-height: 1.5;
}
</style>
