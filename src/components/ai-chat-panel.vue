<template>
  <view
    v-if="visible"
    class="ai-mask"
    @click="close"
  >
    <view
      class="ai-panel"
      @click.stop
    >
      <view class="ai-head">
        <view class="ai-head-main">
          <text class="ai-title">问 AI</text>
          <text class="ai-sub">{{ kbName || '当前知识库' }}</text>
        </view>
        <text class="ai-close" @click="close">关闭</text>
      </view>

      <scroll-view
        scroll-y
        class="ai-body"
        :scroll-top="scrollTop"
      >
        <view v-if="!messages.length" class="ai-empty">
          可以问这个知识库的内容，例如「帮我总结成三点」
        </view>

        <view
          v-for="(msg, index) in messages"
          :key="index"
          class="ai-row"
          :class="{ user: msg.isUser }"
        >
          <view class="ai-bubble" :class="{ user: msg.isUser }">
            <text class="ai-text">{{ msg.content }}</text>
          </view>
        </view>

        <view v-if="loading" class="ai-row">
          <view class="ai-bubble">
            <text class="ai-text">正在思考…</text>
          </view>
        </view>
      </scroll-view>

      <view class="ai-input-row">
        <input
          v-model="input"
          class="ai-input"
          type="text"
          placeholder="输入问题"
          confirm-type="send"
          :disabled="loading"
          @confirm="send"
        />
        <button
          class="ai-send"
          :disabled="!input.trim() || loading"
          @click="send"
        >
          发送
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { baseURL } from '@/utils/request'

interface ChatMessage {
  content: string
  isUser: boolean
}

const props = defineProps<{
  visible: boolean
  kbId: string
  kbName: string
  context: string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const STORAGE_KEY = 'kbAiChatCurrent'
const messages = ref<ChatMessage[]>([])
const input = ref('')
const loading = ref(false)
const scrollTop = ref(0)
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollCount = 0

const scrollToBottom = () => {
  nextTick(() => {
    scrollTop.value = 99999
  })
}

const clearPoll = () => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const saveHistory = () => {
  if (!props.kbId) return
  uni.setStorageSync(STORAGE_KEY, {
    kbId: props.kbId,
    messages: messages.value.slice(-30),
  })
}

const loadHistory = () => {
  clearPoll()
  loading.value = false
  input.value = ''
  if (!props.kbId) {
    messages.value = []
    return
  }
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw && raw.kbId === props.kbId && Array.isArray(raw.messages)) {
      messages.value = raw.messages
    } else {
      // 只保留当前知识库：切到另一个库就清空
      messages.value = []
      uni.setStorageSync(STORAGE_KEY, { kbId: props.kbId, messages: [] })
    }
  } catch {
    messages.value = []
  }
  scrollToBottom()
}

watch(
  () => [props.visible, props.kbId],
  () => {
    if (props.visible) loadHistory()
  },
  { immediate: true },
)

watch(messages, saveHistory, { deep: true })

const close = () => {
  clearPoll()
  emit('close')
}

const cleanAnswer = (text: string) =>
  String(text || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim()

const pollResult = async (taskId: string) => {
  pollCount += 1
  if (pollCount > 60) {
    clearPoll()
    loading.value = false
    messages.value.push({ content: 'AI 响应超时，请稍后重试', isUser: false })
    return
  }

  const token = uni.getStorageSync('accessToken')
  try {
    const res: any = await uni.request({
      url: `${baseURL}/api/v1/ai/ai-chat/result/?task_id=${encodeURIComponent(taskId)}`,
      method: 'GET',
      header: { Authorization: `JWT ${token}` },
    })
    if (res.statusCode !== 200 || !res.data) return
    const outer = String(res.data.status || '').toUpperCase()
    const payload = res.data.data || {}
    const inner = String(payload.status || '').toUpperCase()

    if (outer === 'FAILURE' || inner === 'FAILED' || inner === 'FAILURE') {
      throw new Error(String(payload.error || 'AI 调用失败'))
    }
    if (outer !== 'SUCCESS' || inner === 'PENDING' || inner === 'STARTED') return

    const answer = cleanAnswer(String(payload.answer || ''))
    if (!answer) throw new Error('AI 没有返回内容')
    clearPoll()
    loading.value = false
    messages.value.push({ content: answer, isUser: false })
    scrollToBottom()
  } catch (err) {
    clearPoll()
    loading.value = false
    messages.value.push({
      content: err instanceof Error ? `AI 暂时不可用：${err.message}` : 'AI 暂时不可用',
      isUser: false,
    })
    scrollToBottom()
  }
}

const send = async () => {
  const text = input.value.trim()
  if (!text || loading.value) return
  const token = uni.getStorageSync('accessToken')
  if (!token) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }

  messages.value.push({ content: text, isUser: true })
  input.value = ''
  loading.value = true
  scrollToBottom()

  try {
    const res: any = await uni.request({
      url: `${baseURL}/api/v1/ai/ai-chat/task/`,
      method: 'POST',
      header: {
        Authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        user_message: text,
        current_article: {
          name: props.kbName || '知识库',
          content: props.context || '',
        },
        history_messages: messages.value.slice(-10).map((msg) => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.content,
        })),
      },
    })

    if (res.statusCode !== 202 || !res.data?.task_id) {
      throw new Error(res.data?.error || '创建 AI 任务失败')
    }
    pollCount = 0
    clearPoll()
    pollTimer = setInterval(() => pollResult(res.data.task_id), 1000)
  } catch (err) {
    loading.value = false
    messages.value.push({
      content: err instanceof Error ? `AI 暂时不可用：${err.message}` : 'AI 暂时不可用',
      isUser: false,
    })
    scrollToBottom()
  }
}

onUnmounted(clearPoll)
</script>

<style scoped lang="scss">
.ai-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
  background: rgba(23, 25, 28, 0.45);
  display: flex;
  align-items: flex-end;
}

.ai-panel {
  width: 100%;
  height: 72vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  overflow: hidden;
}

.ai-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 26rpx 30rpx 18rpx;
  border-bottom: 1rpx solid #ececf0;
}

.ai-head-main {
  flex: 1;
  min-width: 0;
}

.ai-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #17191c;
}

.ai-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9aa0a8;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ai-close {
  flex: none;
  margin-left: 20rpx;
  font-size: 26rpx;
  color: #5b616b;
}

.ai-body {
  flex: 1;
  min-height: 0;
  padding: 20rpx 30rpx;
  box-sizing: border-box;
}

.ai-empty {
  padding: 60rpx 20rpx;
  text-align: center;
  font-size: 24rpx;
  line-height: 1.7;
  color: #9aa0a8;
}

.ai-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 18rpx;
}

.ai-row.user {
  justify-content: flex-end;
}

.ai-bubble {
  max-width: 82%;
  padding: 16rpx 20rpx;
  background: #f7f8fa;
  border-radius: 4rpx 16rpx 16rpx 16rpx;
}

.ai-bubble.user {
  background: #fff3ed;
  border-radius: 16rpx 4rpx 16rpx 16rpx;
}

.ai-text {
  font-size: 26rpx;
  line-height: 1.75;
  color: #33373d;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-input-row {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #ececf0;
}

.ai-input {
  flex: 1;
  height: 72rpx;
  padding: 0 22rpx;
  font-size: 26rpx;
  color: #17191c;
  background: #f7f8fa;
  border-radius: 36rpx;
  box-sizing: border-box;
}

.ai-send {
  flex: none;
  width: 120rpx;
  height: 72rpx;
  line-height: 72rpx;
  margin: 0 0 0 16rpx;
  padding: 0;
  font-size: 26rpx;
  color: #ffffff;
  background: #ff8558;
  border-radius: 36rpx;

  &::after {
    border: none;
  }

  &:disabled {
    opacity: 0.5;
  }
}
</style>
