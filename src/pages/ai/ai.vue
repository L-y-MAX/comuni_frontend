<template>
  <view class="ai-page">
    <!-- 聊天记录区域 -->
    <scroll-view
      class="chat-container"
      scroll-y
      :scroll-top="scrollTop"
      @scroll="onScroll"
      ref="scrollRef"
    >
      <!-- 系统提示：根据是否已从文章进入，给出不同引导 -->
      <view
        v-if="hasArticle"
        class="system-message"
      >
        正在针对《{{ articleTitle }}》回答。想换一篇文章，去知识库打开它，再点右上角「问 AI」
      </view>
      <view
        v-else
        class="ai-guide"
      >
        <view class="ai-guide-title">AI 助手怎么用</view>
        <view class="ai-guide-text">这个助手是针对「知识库里的某篇文章」提问的，先选一篇文章：</view>
        <view class="ai-guide-step">1. 去知识库，打开一篇文章</view>
        <view class="ai-guide-step">2. 在文章详情页右上角点「问 AI」</view>
        <view class="ai-guide-step">3. 回到这里，就能让它概括要点、解释代码、出面试题</view>
        <button
          class="ai-guide-btn"
          @click="goKnowledge"
        >
          去知识库选一篇文章
        </button>
      </view>

      <!-- 聊天消息列表 -->
      <view
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message-item', msg.isUser ? 'user-message' : 'ai-message']"
        :style="{ animationDelay: `${index * 0.05}s` }"
      >
        <view class="message-content">{{ msg.content }}</view>

        <!-- 仅 AI 回答：引用核对 + 存回知识库 -->
        <view
          v-if="!msg.isUser"
          class="msg-actions"
        >
          <text
            v-if="verifyQuotes(msg.content).total"
            class="msg-verify"
            :class="{ bad: verifyQuotes(msg.content).failed > 0 }"
          >
            引用核对：{{ verifyQuotes(msg.content).ok }}/{{ verifyQuotes(msg.content).total }} 处可在原文中找到
          </text>
          <text
            class="msg-save"
            @click="saveAnswerToKb(msg.content)"
          >
            存到知识库
          </text>
        </view>
      </view>

      <!-- 加载中提示 -->
      <view
        v-if="isLoading"
        class="loading-indicator"
      >
        <view class="loading-dot"></view>
        <view class="loading-dot"></view>
        <view class="loading-dot"></view>
      </view>
    </scroll-view>

    <!-- 返回底部按钮 -->
    <view
      v-if="showScrollBottomBtn"
      class="scroll-bottom-btn"
      @click="scrollToBottom"
    >
      <view class="arrow-down"></view>
    </view>

    <!-- 示例问题：横向滚动，问题变多也不会挤占聊天区域高度 -->
    <scroll-view
      v-if="hasArticle"
      class="prompt-tips"
      scroll-x
    >
      <view class="prompt-tips-inner">
        <view
          v-for="p in examplePrompts"
          :key="p"
          class="prompt-item"
          @click="usePrompt(p)"
        >
          {{ p }}
        </view>
      </view>
    </scroll-view>

    <!-- 输入区域 -->
    <!-- 上下文：AI 页自己就能选一篇文章，不必先去知识库绕一圈 -->
    <view class="mount-bar">
      <text
        v-if="mountedNoteName"
        class="mount-chip"
        @click="unmountNote"
      >
        上下文：{{ mountedNoteName }}  ✕
      </text>
      <text
        v-else
        class="mount-btn"
        @click="mountNote"
      >
        选择笔记作为上下文
      </text>
    </view>

    <view class="input-area">
      <view class="input-wrapper">
        <textarea
          class="input-box"
          v-model="inputContent"
          placeholder="请输入你的问题..."
          @confirm="
            () => {
              scrollToBottom()
              sendMessage()
            }
          "
          :auto-height="true"
          :maxlength="maxInputLength"
          @input="handleInput"
        ></textarea>
      </view>
      <button
        class="send-btn"
        @click="sendMessage"
        :disabled="!inputContent.trim() || isLoading || inputContent.length > maxInputLength"
      >
        <image
          class="send-icon"
          src="/static/icons/send.png"
          mode="aspectFit"
        />
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Message {
  content: string
  isUser: boolean
}

import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import {
  addKnowledgeNode,
  getKnowledgeBaseList,
  getKnowledgeNodeListByKBId,
} from '@/api/knowledge'
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app' // 新增导入分享生命周期函数

// 初始化状态库
const knowledgeStore = useKnowledgeStore()

// 添加滚动容器的ref引用
const scrollRef = ref<HTMLElement | null>(null)

// 后端接口地址 - 修改为异步任务接口地址
const taskApiUrl = 'http://localhost:8000/api/v1/ai/ai-chat/task/'
const resultApiUrl = 'http://localhost:8000/api/v1/ai/ai-chat/result/'

// 响应式数据 - 指定messages类型
const messages = ref<Message[]>([]) // 关键修复：指定数组元素类型
const inputContent = ref('')
const isLoading = ref(false)
const scrollTop = ref(0)
// 轮询定时器引用 - 替换NodeJS.Timeout为number（Uni-app/浏览器环境定时器ID为数字类型）
const pollTimer = ref<number | null>(null)

// 输入字数限制配置
const maxInputLength = ref(5000) // 设定最大输入字数，可自行调整

// 监听输入内容，处理字数超限提示
const handleInput = () => {
  // 原有字数超限逻辑保留
  if (inputContent.value.length > maxInputLength.value) {
    uni.showToast({
      title: `字数超过${maxInputLength.value}字喽`,
      icon: 'none',
    })
  }
}

// 封装通用的滚动到底部函数
const scrollToBottom = () => {
  nextTick(() => {
    scrollTop.value = 99999
  })
}

// 监听消息变化，智能滚动到底部
watch(messages, () => {
  nextTick(() => {
    scrollTop.value = 99999
  })
})

// 跟踪用户是否主动滚动
const userScrolled = ref(false)
// 控制返回底部按钮显示
const showScrollBottomBtn = ref(false)

// 修改滚动事件处理
const onScroll = (e: { detail: { scrollTop: number; scrollHeight: number } }) => {
  const { scrollTop: st, scrollHeight } = e.detail
  scrollTop.value = st

  // 计算底部阈值（距离底部20rpx以内视为在底部）
  const bottomThreshold = 20
  const containerHeight = uni.getWindowInfo().windowHeight - 120 // 输入区域高度
  const isNearBottom = scrollHeight - st - containerHeight < bottomThreshold

  // 如果用户滚动到了底部，重置用户滚动状态
  userScrolled.value = !isNearBottom

  // 控制返回底部按钮显示/隐藏
  showScrollBottomBtn.value = !isNearBottom
}

// 新增：填充提示语到输入框
const fillPrompt = (promptText: string) => {
  inputContent.value = promptText
}

/**
 * 是否已经带着文章进入
 *
 * 这个助手是针对知识库里的某篇文章提问的（请求时会带上 current_article），
 * 没带文章时它没有上下文，所以先引导用户去选一篇文章。
 */
const hasArticle = computed(() => !!knowledgeStore.currentArticle?.content)
const articleTitle = computed(() => knowledgeStore.currentArticle?.name || '未命名文章')

/** 已挂载的上下文笔记名（空表示没挂） */
const mountedNoteName = computed(() => knowledgeStore.currentArticle?.name || "")

/** 取消挂载：把上下文清掉，之后的提问就不再带文章 */
const unmountNote = () => {
  knowledgeStore.currentArticle = null as any
  uni.showToast({ title: '已取消上下文', icon: 'none' })
}

/**
 * 把整个知识库的文章拼成一份上下文（多篇合一）。
 * 后端只认 current_article 这一个字段，所以整库问答不用改后端：
 * 每篇前面加上标题拼起来，总长度封顶，避免超出模型上下文导致整体失败。
 */
const KB_CONTEXT_LIMIT = 8000
const buildKbContext = (nodes: any[]) => {
  const parts: string[] = []
  let used = 0
  let total = 0
  for (const n of nodes) {
    const body = String(n?.content || '').trim().slice(0, KB_CONTEXT_LIMIT)
    if (!body) continue
    total++
    const chunk = `【${n.name}】\n${body}`
    if (used + chunk.length > KB_CONTEXT_LIMIT) break
    parts.push(chunk)
    used += chunk.length
  }
  return { content: parts.join('\n\n'), used: parts.length, total }
}

/**
 * 选择一篇文章作为上下文。
 * 先选知识库、再选文章：两步都用系统操作菜单，不自绘选择器。
 * 选中后直接写进 knowledgeStore.currentArticle —— 发送逻辑本来就读它，
 * 所以不需要改动原有请求链路。
 */
const mountNote = async () => {
  try {
    const kbRes: any = await getKnowledgeBaseList()
    const kbs: any[] = pickList(kbRes)
    if (!kbs.length) {
      uni.showToast({ title: '还没有知识库，先去创建一个', icon: 'none' })
      return
    }
    uni.showActionSheet({
      itemList: kbs.slice(0, 6).map((kb) => kb.name),
      success: async (kbPicked) => {
        const kb = kbs[kbPicked.tapIndex]
        try {
          const nodeRes: any = await getKnowledgeNodeListByKBId(kb.id)
          const nodes: any[] = pickList(nodeRes)
          if (!nodes.length) {
            uni.showToast({ title: '这个知识库还没有文章', icon: 'none' })
            return
          }
          const picked = nodes.slice(0, 5)
          uni.showActionSheet({
            itemList: [`整个知识库（共 ${nodes.length} 篇）`, ...picked.map((n) => n.name)],
            success: (nodePicked) => {
              // 第 0 项 = 整个知识库：把库内文章拼成一份长上下文，
              // 仍然走原来的 current_article 通道，后端不用改。
              if (nodePicked.tapIndex === 0) {
                const ctx = buildKbContext(nodes)
                if (!ctx.used) {
                  uni.showToast({ title: '这个知识库还没有正文', icon: 'none' })
                  return
                }
                knowledgeStore.currentArticle = {
                  id: kb.id,
                  name: `知识库：${kb.name}（${ctx.used}/${ctx.total} 篇）`,
                  content: ctx.content,
                } as any
                uni.showToast({ title: `已挂载整个知识库（${ctx.used} 篇）`, icon: 'none' })
                return
              }
              const node = picked[nodePicked.tapIndex - 1]
              if (!node) return
              knowledgeStore.currentArticle = {
                ...node,
                name: node.name,
                content: node.content || "",
              } as any
              uni.showToast({ title: `已挂载「${node.name}」`, icon: 'none' })
            },
            fail: () => {},
          })
        } catch {
          uni.showToast({ title: '读取文章失败', icon: 'none' })
        }
      },
      fail: () => {},
    })
  } catch (e) {
    uni.showToast({ title: `读取知识库失败：${String((e as any)?.errMsg || '请检查登录状态')}`, icon: 'none', duration: 2500 })
  }
}

/**
 * 统一从接口响应里取出列表。
 * 后端可能返回数组、{ results } 或 { data: { results } } 三种形态，
 * 只处理一种会导致"看起来没反应"，这里一次兜住。
 */
const pickList = (res: any): any[] => {
  if (Array.isArray(res)) return res
  if (Array.isArray(res?.results)) return res.results
  if (Array.isArray(res?.data?.results)) return res.data.results
  if (Array.isArray(res?.data)) return res.data
  return []
}

/**
 * 预设能力按钮：填入并直接发送，省掉"点两次"的操作。
 */
const usePrompt = (p: string) => {
  // 必须直接写 inputContent：fillPrompt 并不会把值写进输入框，
  // 而 sendMessage 开头就是 if (!content) return，会静默什么都不做。
  inputContent.value = p
  sendMessage()
}

/**
 * 从回答里抠出被引号或书名号包住的片段。
 * 只认成对出现的引号，避免把整段文字当成引用。
 */
const extractQuotes = (text: string): string[] => {
  const out: string[] = []
  const re = /[「『“"]([^」』”"]{4,60})[」』”"]|《([^》]{2,40})》/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const s = (m[1] || m[2] || '').trim()
    if (s) out.push(s)
  }
  return out
}

/**
 * 规范化：去空白 + 统一小写。与 skills 校验器（contract.cjs）同一口径。
 */
const normalizeForMatch = (s: string) =>
  String(s || '').toLowerCase().replace(/[\s\u3000]+/g, '')

/**
 * 核对回答里的引用能否在当前文章原文中找到。
 * 找不到的说明模型可能在编造依据 —— 只提示，不篡改回答内容。
 */
const verifyQuotes = (answer: string) => {
  const quotes = extractQuotes(answer)
  const corpus = normalizeForMatch(knowledgeStore.currentArticle?.content || "")
  let ok = 0
  quotes.forEach((q) => {
    if (corpus.includes(normalizeForMatch(q))) ok++
  })
  return { total: quotes.length, ok, failed: quotes.length - ok }
}

/**
 * 把 AI 回答存进我自己的某个知识库（选库 -> 写入）。
 */
const saveAnswerToKb = async (content: string) => {
  try {
    const res: any = await getKnowledgeBaseList()
    const kbs: any[] = pickList(res)
    if (!kbs.length) {
      uni.showToast({ title: '还没有知识库，先去创建一个', icon: 'none' })
      return
    }
    uni.showActionSheet({
      itemList: kbs.slice(0, 6).map((kb) => kb.name),
      success: async (picked) => {
        const kb = kbs[picked.tapIndex]
        try {
          await addKnowledgeNode({
            name: `AI 回答 · ${new Date().toLocaleString()}`,
            content,
            knowledge_base_id: kb.id,
          })
          uni.showToast({ title: `已存入「${kb.name}」`, icon: 'none' })
        } catch {
          uni.showToast({ title: '存入失败，请稍后重试', icon: 'none' })
        }
      },
      fail: () => {},
    })
  } catch {
    uni.showToast({ title: '读取知识库失败', icon: 'none' })
  }
}
/** 示例问题：让第一次使用的人知道可以问什么 */
const examplePrompts = [
  '这篇文章讲了什么',
  '总结一下这篇文章，控制在500字以内',
  '提炼 3 个最关键的结论',
  '把文中的代码逐段解释一遍',
  '根据这篇文章给我出 5 道面试题',
  '用更简单的话重新讲一遍',
]

/** 没带文章时的引导：去知识库挑一篇 */
const goKnowledge = () => {
  uni.navigateTo({ url: '/pages/knowledge/knowledge' })
}

/** 轮询上限：1 秒一次，最多 60 次；不设上限会在后台没返回时永远转圈 */
const POLL_MAX = 60
const pollCount = ref(0)

/** 取最近一条用户提问（本地检索要用它当关键词） */
const lastUserMessage = () => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].isUser) return messages.value[i].content
  }
  return ''
}

/** 把后端/网络的错误翻译成用户能照着做的说明 */
const describeAiError = (raw: string) => {
  const s = String(raw || '')
  if (/401|InvalidApiKey|Incorrect API key|Unauthorized/i.test(s)) {
    return 'API Key 无效或已过期：请在后台 .env 更新 DASHSCOPE_API_KEY 后重启 Django 与 Celery'
  }
  if (/timeout|timed out|超时/i.test(s)) return '模型响应超时'
  if (/quota|Arrearage|欠费|额度/i.test(s)) return '账号额度不足或欠费'
  return s.slice(0, 120) || '未知错误'
}

/**
 * 本地检索降级：模型不可用时，用提问里的关键词在已挂载内容里找最相关的几句原文。
 * 结果只做原文摘录，绝不冒充 AI 生成的答案，调用处会明确标注。
 */
const localRetrieve = (question: string, topN = 3) => {
  const corpus = String(knowledgeStore.currentArticle?.content || '')
  if (!corpus) return ''
  const terms = (String(question || '').match(/[\u4e00-\u9fa5]{2,}|[A-Za-z][A-Za-z0-9_+#.-]{1,}/g) || [])
    .filter((t) => t.length >= 2)
  if (!terms.length) return ''
  const sentences = corpus
    .split(/[。！？；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
  const scored = sentences
    .map((s) => {
      let score = 0
      terms.forEach((t) => { if (s.includes(t)) score += t.length })
      return { s, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
  if (!scored.length) return ''
  return scored.map((x, i) => `${i + 1}. ${x.s}`).join('\n')
}

// 轮询查询任务结果
const pollTaskResult = async (taskId: string) => {
  try {
    pollCount.value++
    if (pollCount.value > POLL_MAX) throw new Error('等待超时：后台一直没返回结果')
    const accessToken = uni.getStorageSync('accessToken')
    const response = await uni.request({
      url: `${resultApiUrl}?task_id=${taskId}`,
      method: 'GET',
      header: {
        Authorization: `JWT ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.statusCode !== 200 || !response.data) {
      throw new Error('查询任务结果失败')
    }
    const responseData = response.data as AnyObject
    const payload = (responseData.data || {}) as AnyObject
    const outer = String(responseData.status || "").toUpperCase()
    const inner = String(payload.status || "").toUpperCase()

    // 失败要同时看内外层：后端任务失败时是 return 字典、Celery 状态仍是 SUCCESS，
    // 只看外层会把失败当成功，接着读到一个空的 answer（表现就是"不回答"）。
    if (outer === 'FAILURE' || inner === 'FAILED' || inner === 'FAILURE') {
      throw new Error(String(payload.error || responseData.message || '模型调用失败'))
    }
    if (outer !== 'SUCCESS' || inner === 'PENDING' || inner === 'STARTED') {
      return // 仍在处理中，继续轮询
    }

    const answer = typeof payload.answer === 'string' ? payload.answer.trim() : ''
    if (!answer) throw new Error('模型没有返回内容')

    clearInterval(pollTimer.value!)
    pollTimer.value = null
    messages.value.push({
      content: answer,
      isUser: false,
    })
    scrollToBottom()
    isLoading.value = false
  } catch (error) {
    clearInterval(pollTimer.value!)
    pollTimer.value = null
    console.error('轮询任务结果错误:', error)
    const reason = describeAiError(String((error as any)?.message || (error as any)?.errMsg || error))
    const local = localRetrieve(lastUserMessage())
    messages.value.push({
      content: local
        ? `模型暂时不可用（${reason}）。\n下面是从你挂载的内容里本地检索到的原文片段（非 AI 生成，仅供参考）：\n${local}`
        : `模型暂时不可用：${reason}`,
      isUser: false,
    })
    scrollToBottom()
    isLoading.value = false
  }
}

// 发送消息（调用后端异步任务接口）
const sendMessage = async () => {
  const content = inputContent.value.trim()
  if (!content || isLoading.value) return

  // 添加用户消息
  messages.value.push({
    content,
    isUser: true,
  })

  // 发送消息后立即滚动到底部
  scrollToBottom()

  inputContent.value = ''
  isLoading.value = true

  try {
    const accessToken = uni.getStorageSync('accessToken')
    if (!accessToken) {
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return
    }
    // 获取知识库数据
    const { currentArticle } = knowledgeStore

    // 修复：只保留current_article的name和content字段
    const simplifiedArticle = currentArticle
      ? {
          name: currentArticle.name || '',
          content: currentArticle.content || '',
        }
      : { name: '', content: '' }

    // 构建请求后端的参数
    const requestData = {
      user_message: content,
      current_article: simplifiedArticle, // 使用精简后的文章数据
      history_messages: messages.value.map((msg) => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content,
      })),
    }

    // 第一步：调用创建异步任务接口
    const taskResponse = await uni.request({
      url: taskApiUrl,
      method: 'POST',
      header: {
        Authorization: `JWT ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: requestData,
    })

    // 处理任务创建响应
    if (taskResponse.statusCode === 202 && taskResponse.data) {
      const taskData = taskResponse.data as AnyObject
      const taskId = taskData.task_id
      if (!taskId) {
        throw new Error('获取任务ID失败')
      }
      pollCount.value = 0
      // 第二步：启动轮询（每隔1秒查询一次结果）
      pollTimer.value = setInterval(() => {
        pollTaskResult(taskId)
      }, 1000)
    } else {
      let errorMsg = '创建任务失败'
      if (taskResponse.data && typeof taskResponse.data === 'object') {
        errorMsg = (taskResponse.data as AnyObject).error || errorMsg
      }
      throw new Error(errorMsg)
    }
  } catch (error) {
    console.error('调用后端AI任务接口错误:', error)
    messages.value.push({
      content: '抱歉，创建请求失败，请稍后再试',
      isUser: false,
    })
    scrollToBottom()
    isLoading.value = false
    // 清理轮询定时器
    if (pollTimer.value) {
      clearInterval(pollTimer.value)
      pollTimer.value = null
    }
  }
}

// 页面挂载时执行
onMounted(() => {
  console.log('AI助手页面初始化完成')

  // 获取跳转传递的prompt参数
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as { options: { prompt?: string } }

  if (currentPage.options?.prompt) {
    inputContent.value = decodeURIComponent(currentPage.options.prompt)
  }

  scrollToBottom()
})

// ========== 新增：微信小程序分享功能 ==========
// 分享给好友（胶囊按钮三点菜单触发）
onShareAppMessage(() => {
  return {
    title: 'AI智能助手 - 智能问答文章内容', // 分享标题
    path: '/pages/ai/ai', // 分享后打开的页面路径（根据实际页面路径调整）
    imageUrl: 'https://youupro.xyz/notes/static/icons/ai-share.png', // 可选：分享卡片图片
    desc: '快来体验AI智能问答，轻松理解文章内容！', // 可选：分享描述
  }
})

// 分享到朋友圈（胶囊按钮三点菜单触发）
onShareTimeline(() => {
  return {
    title: 'AI智能助手 - 智能问答文章内容', // 朋友圈分享标题
    path: '/pages/ai/ai', // 分享后打开的页面路径（根据实际页面路径调整）
    imageUrl: 'https://youupro.xyz/notes/static/icons/ai-share.png', // 可选：朋友圈分享图片
  }
})
</script>

<style scoped lang="scss">
.ai-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #ffffff;
  overflow: hidden;
}

.chat-container {
  flex: 1;
  padding: 20rpx;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  height: calc(100vh - 120rpx);
  overflow: hidden;
}

.system-message {
  text-align: center;
  color: #666666;
  font-size: 26rpx;
  padding: 15rpx 20rpx;
  background-color: #f5f5f5;
  border-radius: 20rpx;
  margin: 10rpx auto 30rpx;
  max-width: 60%;
}

.message-item {
  display: flex;
  margin-bottom: 30rpx;
  max-width: 80%;
  animation: fadeIn 0.3s ease forwards;
  opacity: 0;
  transform: translateY(10rpx);
}

@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-message {
  flex-direction: row-reverse;
  margin-left: auto;
}

.ai-message {
  margin-right: auto;
}

.message-content {
    white-space: pre-wrap;
  padding: 20rpx 25rpx;
  border-radius: 22rpx;
  font-size: 30rpx;
  line-height: 1.6;
  word-wrap: break-word;
  word-break: break-all;
  max-width: calc(100% - 80rpx);
}

.user-message .message-content {
  background-color: #007bff;
  color: #ffffff;
  border-bottom-right-radius: 6rpx;
}

.ai-message .message-content {
  background-color: #f0f0f0;
  color: #333333;
  border-bottom-left-radius: 6rpx;
}

/* 返回底部按钮样式 */
.scroll-bottom-btn {
  position: absolute;
  right: 40rpx;
  bottom: 160rpx;
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  z-index: 5;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: 0.9;
  -webkit-tap-highlight-color: transparent;
}

.scroll-bottom-btn:hover {
  opacity: 1;
}

.scroll-bottom-btn:active {
  background-color: #ffffff;
  box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.12);
  transform: scale(0.95);
}

.arrow-down {
  width: 24rpx;
  height: 24rpx;
  border: 4rpx solid #6b7280;
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
}

/* 未关联文章时的引导卡片 */
.ai-guide {
  margin: 10rpx 20rpx 30rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, rgba(255, 90, 48, 0.06) 0%, rgba(255, 90, 48, 0.02) 100%);
  border: 2rpx solid rgba(255, 90, 48, 0.18);
}

.ai-guide-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #ff5a30;
  margin-bottom: 12rpx;
}

.ai-guide-text {
  font-size: 26rpx;
  line-height: 1.6;
  color: #666666;
  margin-bottom: 12rpx;
}

.ai-guide-step {
  font-size: 26rpx;
  line-height: 1.8;
  color: #444444;
  padding-left: 8rpx;
}

.ai-guide-btn {
  margin-top: 20rpx;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 28rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #FF8A54 0%, #FF7239 100%);
  border-radius: 36rpx;
  border: none;
}
/* 悬浮提示按钮样式：改为横向滚动，示例问题变多也不会挤占聊天区域高度 */
.prompt-tips {
  width: 100%;
  box-sizing: border-box;
  padding: 10rpx 0;
  white-space: nowrap;
}

.prompt-tips-inner {
  display: inline-flex;
  gap: 15rpx;
  padding: 0 20rpx;
}

.prompt-item {
  flex: none;
  padding: 8rpx 15rpx;
  background-color: #f0f8ff;
  color: #ff5a30;
  font-size: 26rpx;
  border-radius: 15rpx;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.prompt-item:active {
  background-color: #e6f7ff;
  transform: scale(0.98);
}

/* 输入区域容器样式（恢复原有行布局） */
.input-area {
  display: flex;
  align-items: center;
  padding: 15rpx 20rpx;
  background-color: #ffffff;
  border-top: 1rpx solid #e0e0e0;
  box-sizing: border-box;
  z-index: 10;
  max-height: 300rpx;
}

/* 输入框外层容器（恢复原有样式） */
.input-wrapper {
  flex: 1;
  margin-right: 60rpx;
  align-items: center;
}

.input-box {
  width: 100%;
  min-height: 40rpx;
  max-height: 520rpx;
  padding: 10rpx 20rpx;
  align-items: center;
  background-color: #f9f9f9;
  border-radius: 20rpx;
  font-size: 30rpx;
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
  border: 1rpx solid #e0e0e0;
  transition: all 0.2s ease;
}

.input-box:focus {
  border-color: #007bff;
  outline: none;
}

/* 发送按钮 */
.send-btn {
  width: 80rpx;
  height: 80rpx;
  margin-left: 15rpx;
  background-color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #ffe4d9;
  transition: all 0.2s ease;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  -webkit-appearance: none;
  appearance: none;
  outline: none;
  box-shadow: none;
}

/* 有输入文字（启用）状态 */
.send-btn:not(:disabled) {
  background-color: #ffffff;
  border-color: #ffd9c7;
}

/* 长按（激活）状态 */
.send-btn:not(:disabled):active {
  background-color: #fff1eb;
  border-color: #ffb89e;
  transform: scale(0.95);
}

/* 按钮禁用状态样式 */
.send-btn:disabled {
  background-color: #ffffff;
  border-color: #eef0f3;
  opacity: 0.5;
  cursor: not-allowed;
  -webkit-appearance: none;
  appearance: none;
}

/* 发送按钮内部的图标样式 */
.send-icon {
  width: 60rpx;
  height: 60rpx;
  display: block;
  border: none;
  outline: none;
  transform: scale(2);
  transform-origin: center center;
  border-radius: 100%;
}

/* 加载动画 */
.loading-indicator {
  display: flex;
  justify-content: center;
  padding: 20rpx 0;
}

.loading-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background-color: #007bff;
  margin: 0 8rpx;
  animation: loading 1.4s infinite ease-in-out both;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes loading {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* AI 回答下方的操作区 */
.msg-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 14rpx;
}

.msg-verify {
  font-size: 21rpx;
  color: #16a34a;
  background: #f0fdf4;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;

  &.bad {
    color: #dc2626;
    background: #fef2f2;
  }
}

.msg-save {
  font-size: 21rpx;
  color: #FF7239;
  border: 2rpx solid #FF7239;
  border-radius: 8rpx;
  padding: 2rpx 12rpx;
}

/* 上下文挂载栏 */
.mount-bar {
  display: flex;
  align-items: center;
  padding: 12rpx 24rpx 4rpx;
}

.mount-btn {
  font-size: 22rpx;
  color: #6b7280;
  border: 2rpx solid #e5e7eb;
  border-radius: 24rpx;
  padding: 6rpx 20rpx;
}

.mount-chip {
  max-width: 100%;
  font-size: 22rpx;
  color: #FF7239;
  background: #fff7f2;
  border: 2rpx solid #ffd0bb;
  border-radius: 24rpx;
  padding: 6rpx 20rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
