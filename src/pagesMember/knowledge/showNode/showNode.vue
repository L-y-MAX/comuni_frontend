<template>
  <view class="node-detail-page">
    <!-- 悬浮按钮组：仅详情模式显示（编辑+复制 纵向排列） -->
    <view class="float-btn-group">
      <!-- AI按钮 -->
      <view class="float-btn-wrap">
        <view
          class="icon-content"
          hover-class="icon-hover"
        >
          <view
            class="btn-inner"
            @click="toAI"
          >
            <view class="filled"></view>
            <image
              src="https://youupro.xyz/notes/static/icons/aichat.png"
              class="icon-img"
              mode="aspectFit"
            ></image>
          </view>
          <view class="tooltip">问 AI</view>
        </view>
      </view>

      <!-- 评论按钮 -->
      <view class="float-btn-wrap">
        <view
          class="icon-content"
          hover-class="icon-hover"
        >
          <view
            class="btn-inner"
            @click="openCommentPanel"
          >
            <view class="filled"></view>
            <image
              src="https://youupro.xyz/notes/static/icons/comment.png"
              class="icon-img"
              mode="aspectFit"
            ></image>
          </view>
          <view class="tooltip">评论区</view>
        </view>
      </view>

      <!-- 复制文章内容按钮 -->
      <view class="float-btn-wrap">
        <view
          class="icon-content"
          hover-class="icon-hover"
        >
          <view
            class="btn-inner"
            @click="copyContent"
          >
            <view class="filled"></view>
            <image
              src="https://youupro.xyz/notes/static/icons/copy.png"
              class="icon-img"
              mode="aspectFit"
            ></image>
          </view>
          <view class="tooltip">一键复制</view>
        </view>
      </view>

      <!-- 编辑模式按钮 -->
      <view class="float-btn-wrap">
        <view
          class="icon-content"
          hover-class="icon-hover"
        >
          <view
            class="btn-inner"
            @click="toEdit"
          >
            <view class="filled"></view>
            <image
              src="https://youupro.xyz/notes/static/icons/compile.png"
              class="icon-img"
              mode="aspectFit"
            ></image>
          </view>
          <view class="tooltip">编辑模式</view>
        </view>
      </view>
    </view>

    <!-- 内容区域：仅展示详情 -->
    <scroll-view
      class="content-scroll"
      scroll-y
      :style="{ paddingBottom: '30rpx' }"
    >
      <!-- 详情模式：内容展示（移除描述，使用marked渲染Markdown） -->
      <view class="detail-container">
        <view class="detail-title">{{ formData.name }}</view>
        <view class="detail-content">
          <rich-text :nodes="renderedContent"></rich-text>
        </view>
      </view>
    </scroll-view>

    <!-- 抖音风格半屏评论区 -->
    <view
      class="comment-panel"
      :class="{ show: commentPanelShow }"
    >
      <!-- 评论区头部 -->
      <view class="comment-header">
        <view class="comment-title">评论区 ({{ commentList.length }})</view>
        <view
          class="close-btn"
          @click="closeCommentPanel"
        >
          ✕
        </view>
      </view>

      <!-- 评论列表 -->
      <scroll-view
        class="comment-list"
        scroll-y
      >
        <!-- 空状态 -->
        <view
          class="empty-comment"
          v-if="commentList.length === 0 && !loading"
        >
          <text class="empty-text">暂无评论，快来抢沙发～</text>
        </view>

        <!-- 加载中 -->
        <view
          class="loading-comment"
          v-if="loading"
        >
          <text class="loading-text">加载评论中...</text>
        </view>

        <!-- 根评论列表 -->
        <view
          class="root-comment-item"
          v-for="(item, index) in commentList"
          :key="item.id"
        >
          <!-- 根评论内容 -->
          <view class="comment-main">
            <view class="comment-user-info">
              <view class="user-time-wrap">
                <text class="username">{{ item.user_info?.username || '匿名用户' }}</text>
                <text class="comment-time">{{ formatTime(item.comment_date) }}</text>
              </view>
            </view>
            <view class="comment-content">{{ item.comment_text }}</view>
            <!-- 根评论操作区：回复 + 删除按钮 + 展开/折叠回复 -->
            <view class="comment-actions">
              <view
                class="reply-btn"
                @click="showReplyInput(index)"
              >
                <text>回复</text>
              </view>
              <!-- 自己的评论显示删除按钮  -->
              <view
                class="delete-btn"
                v-if="
                  currentUserId &&
                  currentUserId !== '' &&
                  item.user_info?.id &&
                  item.user_info.id === currentUserId
                "
                @click="deleteComment(item.id, true)"
              >
                <text>删除</text>
              </view>
              <!-- 展开/折叠回复按钮 -->
              <view
                class="expand-btn"
                @click="toggleAnswers(index)"
              >
                <text v-if="!item.isExpanded">查看回复</text>
                <text v-else-if="item.isLoadingAnswers">加载中...</text>
                <text v-else-if="item.loadedAnswerCount < item.answerTotalCount">
                  加载更多({{ item.answerTotalCount - item.loadedAnswerCount }})
                </text>
                <text v-else-if="item.answers.length > 0">收起回复</text>
                <text v-else>暂无回复</text>
              </view>
            </view>
          </view>

          <!-- 回复输入框：仅当前根评论显示回复框 -->
          <view
            class="reply-input-wrap"
            v-if="replyIndex === index && replyAnsIndex === -1"
          >
            <textarea
              class="reply-input"
              v-model="replyText"
              placeholder="输入回复内容..."
              :maxlength="500"
              auto-height
              show-confirm-bar
            ></textarea>
            <view class="reply-btn-group">
              <view
                class="cancel-btn"
                @click="hideReplyInput"
              >
                取消
              </view>
              <view
                class="send-btn"
                @click="sendReply(item.id)"
                :class="{ disabled: !replyText.trim() }"
              >
                发送
              </view>
            </view>
          </view>

          <!-- 回复评论列表 -->
          <view
            class="answer-comment-list"
            v-if="item.isExpanded"
          >
            <!-- 回复加载中状态 -->
            <view
              class="answer-loading"
              v-if="item.isLoadingAnswers"
            >
              <text>加载回复中...</text>
            </view>

            <!-- 无回复提示 -->
            <view
              class="no-answers"
              v-else-if="item.answerTotalCount === 0 && item.loadedAnswerCount === 0"
            >
              <text>暂无回复</text>
            </view>

            <!-- 有回复时显示列表 -->
            <view
              class="answer-comment-item"
              v-for="(answer, ansIndex) in item.answers"
              :key="answer.id || `ans-${index}-${ansIndex}`"
              v-else
            >
              <view class="answer-user-info">
                <view class="user-time-wrap">
                  <text class="answer-username">
                    {{ answer.user_info?.username || '匿名用户' }}
                  </text>
                  <text class="answer-time">{{ formatTime(answer.comment_date) }}</text>
                </view>
              </view>
              <view class="answer-content">
                {{ answer.comment_text || '（回复内容为空）' }}
              </view>
              <!-- 子评论操作区：回复 + 删除按钮 -->
              <view class="answer-actions">
                <view
                  class="reply-btn"
                  @click="showReplyToAnswer(index, ansIndex)"
                >
                  <text>回复</text>
                </view>
                <!-- 自己的回复显示删除按钮 -->
                <view
                  class="delete-btn"
                  v-if="
                    currentUserId &&
                    currentUserId !== '' &&
                    answer.user_info?.id &&
                    answer.user_info.id === currentUserId
                  "
                  @click="deleteComment(answer.id, false)"
                >
                  <text>删除</text>
                </view>
              </view>

              <!-- 回复子评论的输入框 -->
              <view
                class="reply-input-wrap"
                v-if="replyIndex === index && replyAnsIndex === ansIndex"
              >
                <textarea
                  class="reply-input"
                  v-model="replyText"
                  placeholder="输入回复内容..."
                  :maxlength="500"
                  auto-height
                  show-confirm-bar
                ></textarea>
                <view class="reply-btn-group">
                  <view
                    class="cancel-btn"
                    @click="hideReplyInput"
                  >
                    取消
                  </view>
                  <view
                    class="send-btn"
                    @click="sendReply(item.id)"
                    :class="{ disabled: !replyText.trim() }"
                  >
                    发送
                  </view>
                </view>
              </view>
            </view>

            <!-- 没有更多回复提示 -->
            <view
              class="no-more-answers"
              v-if="item.loadedAnswerCount >= item.answerTotalCount && item.answerTotalCount > 0"
            >
              <text>已显示全部回复</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 底部新增根评论输入框 -->
      <view class="add-comment-wrap">
        <textarea
          class="comment-input"
          v-model="newCommentText"
          placeholder="独立思考 明辨是非"
          :maxlength="500"
          auto-height
          show-confirm-bar
        ></textarea>
        <view
          class="send-comment-btn"
          @click="sendRootComment"
          :class="{ disabled: !newCommentText.trim() }"
        >
          发送
        </view>
      </view>
    </view>

    <!-- 评论区遮罩层 -->
    <view
      class="comment-mask"
      v-if="commentPanelShow"
      @click="closeCommentPanel"
    ></view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getCurrentInstance, nextTick, onMounted, reactive, ref } from 'vue'
import { getKnowledgeNodeDetail } from '@/api/knowledge'
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
import { useKnowledgeStore } from '@/stores/knowledge'
// 注意：这里替换为新的评论API导入
import {
  getNodeRootComments, // 新API：获取根评论列表
  getNodeAnswerComments, // 新API：获取指定根评论的回复列表
  addNodeComment,
  deleteNodeComment,
  CommentType,
} from '@/pagesMember/knowledge/showNode/comment'
import type { CommentItem } from '@/pagesMember/knowledge/showNode/comment'
import { useUserStore } from './user'

// 初始化状态库
const knowledgeStore = useKnowledgeStore()
const userStore = useUserStore()

// ========== Marked配置初始化 ==========
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
)

// ========== 类型定义 ==========
interface TocItem {
  id: string
  title: string
  level: number
}

// 扩展根评论类型
interface RootCommentItem extends CommentItem {
  isExpanded: boolean // 是否展开回复
  isLoadingAnswers: boolean // 回复加载中
  loadedAnswerCount: number // 已加载回复数
  answerTotalCount: number // 回复总数
  answers: CommentItem[] // 该根评论的回复列表
  currentOffset: number // 回复列表分页偏移量（代码实际使用的字段）
}

// ========== 响应式数据 ==========
const formData = reactive({
  id: '',
  name: '',
  content: '',
  description: '',
  knowledge_base_id: '',
})

const renderedContent = ref('')

// 评论区相关数据
const commentPanelShow = ref(false) // 评论区显示状态
const loading = ref(false) // 根评论加载中
const commentList = ref<RootCommentItem[]>([]) // 根评论列表
const newCommentText = ref('') // 新增根评论内容
const replyIndex = ref(-1) // 当前回复的根评论索引
const replyAnsIndex = ref(-1) // 当前回复的子评论索引
const replyText = ref('') // 回复内容
const currentUserId = ref('')
const PAGE_SIZE = 5 // 每次加载回复数量

// ========== 初始化用户ID ==========
const initCurrentUserId = () => {
  try {
    // 优先从userStore获取
    if (userStore && userStore.userInfo && userStore.userInfo.id) {
      const userInfo = userStore.userInfo
      currentUserId.value = userInfo.id || userInfo.userId || ''
      return
    }

    // 从storage读取
    const userInfoValue = uni.getStorageSync('userInfo')
    if (!userInfoValue) {
      currentUserId.value = ''
      return
    }

    let userInfo = null
    if (typeof userInfoValue === 'string') {
      userInfo = JSON.parse(userInfoValue)
    } else if (typeof userInfoValue === 'object' && userInfoValue !== null) {
      userInfo = userInfoValue
    } else {
      currentUserId.value = ''
      return
    }

    currentUserId.value = userInfo.id || userInfo.userId || userInfo.user_id || ''
  } catch (error) {
    console.error('读取用户信息失败：', error)
    currentUserId.value = ''
  }
}

// ========== 核心方法 ==========
const toAI = () => {
  // 1. 将当前文章的formData存入Pinia
  knowledgeStore.setCurrentArticle({
    id: formData.id,
    name: formData.name,
    content: formData.content,
    description: formData.description,
    knowledge_base_id: formData.knowledge_base_id,
  })

  // 2. 跳转至AI页面
  uni.switchTab({
    url: '/pages/ai/ai',
    fail: (err) => {
      console.error('跳转AI页面失败：', err)
      uni.showToast({ title: '跳转失败，请重试', icon: 'none' })
    },
  })
}

// 复制文章内容方法
const copyContent = () => {
  if (!formData.content.trim()) {
    uni.showToast({ title: '文章内容为空', icon: 'none', duration: 2000 })
    return
  }

  uni.setClipboardData({
    data: formData.content,
    success: () => {
      uni.showToast({ title: '复制成功', icon: 'success', duration: 2000 })
    },
    fail: (err) => {
      console.error('复制失败：', err)
      uni.showToast({ title: '复制失败，请重试', icon: 'none', duration: 2000 })
    },
  })
}

// 评论区核心方法
const openCommentPanel = () => {
  commentPanelShow.value = true
  fetchRootComments() // 使用新API加载根评论
}

const closeCommentPanel = () => {
  commentPanelShow.value = false
  replyIndex.value = -1
  replyAnsIndex.value = -1
  replyText.value = ''
  newCommentText.value = ''
}

// ========== 加载根评论（使用新API） ==========
const fetchRootComments = async () => {
  if (!formData.id) return
  loading.value = true
  try {
    // 调用新API：获取指定文章的根评论列表（offset从0开始）
    const rootRes = await getNodeRootComments({
      article_id: formData.id,
      offset: 0, // 第一页偏移量为0
      limit: 20, // 根评论默认每页20条
    })

    if (rootRes && Array.isArray(rootRes.results)) {
      // 格式化根评论，初始化回复相关字段
      commentList.value = rootRes.results.map((item: any) => ({
        ...item,
        isExpanded: false, // 默认折叠
        isLoadingAnswers: false, // 回复加载中状态
        loadedAnswerCount: 0, // 已加载回复数
        answerTotalCount: item.answer_count || 0, // 直接使用根评论的answer_count作为回复总数
        answers: [], // 回复列表
        currentOffset: 0, // 替换currentPage为currentOffset（偏移量）
        // 兜底字段
        user_info: item.user_info || { id: '', username: '匿名用户' },
        comment_text: item.comment_text || '（内容已删除）',
        comment_date: item.comment_date || '',
        id: item.id || `root-${Math.random().toString(36).substr(2, 9)}`,
      }))
    } else {
      commentList.value = []
    }
  } catch (error) {
    console.error('加载根评论失败：', error)
    commentList.value = []
  } finally {
    loading.value = false
  }
}

// 切换回复展开/折叠状态（点击展开时触发新API请求）
const toggleAnswers = async (index: number) => {
  const currentComment = commentList.value[index]

  // 如果是收起回复
  if (currentComment.isExpanded) {
    currentComment.isExpanded = false
    return
  }

  // 标记为展开状态
  currentComment.isExpanded = true

  // 如果已有加载的回复但还有更多，加载下一页
  if (
    currentComment.loadedAnswerCount > 0 &&
    currentComment.loadedAnswerCount < currentComment.answerTotalCount
  ) {
    await loadMoreAnswers(index)
    return
  }

  // 首次加载回复（调用新API）
  await loadAnswers(index)
}

// 加载根评论的回复（使用新API）
const loadAnswers = async (index: number) => {
  const currentComment = commentList.value[index]

  if (!currentComment.id || currentComment.isLoadingAnswers) {
    return
  }

  // 标记为加载中
  currentComment.isLoadingAnswers = true

  try {
    // 调用新API：获取指定文章+指定根评论的回复列表（offset从0开始）
    const answerRes = await getNodeAnswerComments({
      article_id: formData.id, // 文章Node的PK
      root_id: currentComment.id, // 根评论的PK
      offset: 0, // 第一页偏移量为0
      limit: PAGE_SIZE, // 每页加载数量
    })

    // 处理返回结果
    if (answerRes) {
      // 更新回复总数
      currentComment.answerTotalCount = answerRes.count || 0

      if (Array.isArray(answerRes.results) && answerRes.results.length > 0) {
        // 格式化回复数据
        const formattedAnswers = answerRes.results.map((answer: any) => ({
          ...answer,
          user_info: answer.user_info || { id: '', username: '匿名用户' },
          comment_text: answer.comment_text || '（回复内容已删除）',
          comment_date: answer.comment_date || '',
          id: answer.id || `ans-${currentComment.id}-${Math.random()}`,
          root_id: answer.root_id || currentComment.id,
          article_id: answer.article_id || formData.id,
          type: CommentType.ANSWER,
        }))

        // 首次加载：直接赋值
        currentComment.answers = formattedAnswers
        currentComment.loadedAnswerCount = formattedAnswers.length
        currentComment.currentOffset = formattedAnswers.length
      } else {
        // 无回复
        currentComment.answers = []
        currentComment.loadedAnswerCount = 0
        currentComment.currentOffset = 0
      }
    }
  } catch (error) {
    console.error(`加载根评论${currentComment.id}的回复失败：`, error)
    uni.showToast({ title: '加载回复失败', icon: 'none' })
    currentComment.answerTotalCount = 0
    currentComment.answers = []
    currentComment.loadedAnswerCount = 0
  } finally {
    currentComment.isLoadingAnswers = false
  }
}

// 加载更多回复（分页加载）
const loadMoreAnswers = async (index: number) => {
  const currentComment = commentList.value[index]

  // 校验：是否还有更多回复可加载
  if (
    currentComment.loadedAnswerCount >= currentComment.answerTotalCount ||
    currentComment.isLoadingAnswers
  ) {
    return
  }

  // 标记为加载中
  currentComment.isLoadingAnswers = true

  try {
    // 调用新API加载下一页回复（使用currentOffset作为偏移量）
    const answerRes = await getNodeAnswerComments({
      article_id: formData.id,
      root_id: currentComment.id,
      offset: currentComment.currentOffset || 0,
      limit: PAGE_SIZE,
    })

    if (answerRes && Array.isArray(answerRes.results) && answerRes.results.length > 0) {
      // 格式化新回复数据
      const newAnswers = answerRes.results.map((answer: any) => ({
        ...answer,
        user_info: answer.user_info || { id: '', username: '匿名用户' },
        comment_text: answer.comment_text || '（回复内容已删除）',
        comment_date: answer.comment_date || '',
        id: answer.id || `ans-${currentComment.id}-${Math.random()}`,
        root_id: answer.root_id || currentComment.id,
        article_id: answer.article_id || formData.id,
        type: CommentType.ANSWER,
      }))

      // 追加新回复到现有列表
      currentComment.answers = [...currentComment.answers, ...newAnswers]
      currentComment.loadedAnswerCount = currentComment.answers.length
      currentComment.currentOffset = currentComment.answers.length // 推进偏移量，供下一页使用
    }
  } catch (error) {
    console.error(`加载根评论${currentComment.id}更多回复失败：`, error)
    uni.showToast({ title: '加载更多回复失败', icon: 'none' })
  } finally {
    currentComment.isLoadingAnswers = false
  }
}

// 发送根评论
const sendRootComment = async () => {
  const content = newCommentText.value.trim()
  if (!content) {
    uni.showToast({ title: '评论内容不能为空', icon: 'none' })
    return
  }

  try {
    await addNodeComment({
      article_id: formData.id,
      comment_text: content,
      type: CommentType.ROOT,
    })
    uni.showToast({ title: '评论成功', icon: 'success' })
    newCommentText.value = ''
    fetchRootComments() // 重新加载根评论
  } catch (error) {
    console.error('发布评论失败：', error)
    uni.showToast({ title: '评论失败，请重试', icon: 'none' })
  }
}

// 显示根评论回复框
const showReplyInput = (index: number) => {
  replyIndex.value = index
  replyAnsIndex.value = -1
  replyText.value = ''

  nextTick(() => {
    const instance = getCurrentInstance()
    if (!instance) return

    const query = uni.createSelectorQuery().in(instance)
    query
      .select(`.reply-input-wrap`)
      .boundingClientRect((rectRes) => {
        if (rectRes && !Array.isArray(rectRes)) {
          const rectInfo = rectRes as UniApp.NodeInfo
          if (rectInfo.top !== undefined) {
            uni.pageScrollTo({
              scrollTop: rectInfo.top - 100,
              duration: 300,
            })
          }
        }
      })
      .exec()
  })
}

// 显示回复子评论的输入框
const showReplyToAnswer = (rootIndex: number, ansIndex: number) => {
  replyIndex.value = rootIndex
  replyAnsIndex.value = ansIndex
  const targetAnswer = commentList.value[rootIndex].answers?.[ansIndex]
  if (targetAnswer) {
    replyText.value = `@${targetAnswer.user_info?.username || '匿名用户'} `
  }

  nextTick(() => {
    const instance = getCurrentInstance()
    if (!instance) return

    const query = uni.createSelectorQuery().in(instance)
    query
      .selectAll(`.answer-comment-item`)
      .boundingClientRect((rectRes) => {
        if (Array.isArray(rectRes)) {
          const rectInfo = rectRes[ansIndex] as UniApp.NodeInfo
          if (rectInfo && rectInfo.top !== undefined) {
            uni.pageScrollTo({
              scrollTop: rectInfo.top - 100,
              duration: 300,
            })
          }
        }
      })
      .exec()
  })
}

// 隐藏回复输入框
const hideReplyInput = () => {
  replyIndex.value = -1
  replyAnsIndex.value = -1
  replyText.value = ''
}

// 发送回复
const sendReply = async (rootId: string) => {
  const content = replyText.value.trim()
  if (!content) {
    uni.showToast({ title: '回复内容不能为空', icon: 'none' })
    return
  }

  // 获取回复目标用户ID
  let toUserId = ''
  if (replyAnsIndex.value > -1) {
    // 回复子评论
    const targetAnswer = commentList.value[replyIndex.value].answers?.[replyAnsIndex.value]
    toUserId = targetAnswer?.user_info?.id || ''
  } else {
    // 回复根评论
    const targetComment = commentList.value[replyIndex.value]
    toUserId = targetComment?.user_info?.id || ''
  }

  try {
    await addNodeComment({
      article_id: formData.id,
      comment_text: content,
      type: CommentType.ANSWER,
      root_id: rootId,
      to_user_id: toUserId,
    })
    // 注意：必须先把索引存下来，hideReplyInput() 会把 replyIndex 重置为 -1，
    // 之后再判断 replyIndex.value > -1 恒为 false，回复就不会刷新了
    const targetIndex = replyIndex.value
    uni.showToast({ title: '回复成功', icon: 'success' })
    hideReplyInput()

    // 重新加载该根评论的回复
    if (targetIndex > -1) {
      const currentComment = commentList.value[targetIndex]
      currentComment.loadedAnswerCount = 0
      currentComment.currentOffset = 0
      currentComment.isExpanded = true
      currentComment.answers = []
      await loadAnswers(targetIndex)
    }
  } catch (error) {
    console.error('回复失败：', error)
    uni.showToast({ title: '回复失败，请重试', icon: 'none' })
  }
}

// 删除评论
const deleteComment = async (commentId: string, isRoot: boolean) => {
  if (!commentId || !formData.id) {
    uni.showToast({ title: '评论ID无效', icon: 'none' })
    return
  }

  uni.showModal({
    title: '提示',
    content: isRoot ? '删除根评论会同时删除所有回复，确定删除吗？' : '确定删除这条回复吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteNodeComment(formData.id, commentId)
          uni.showToast({ title: '删除成功', icon: 'success' })

          if (isRoot) {
            fetchRootComments() // 删除根评论重新加载列表
          } else {
            // 删除回复后，重新加载对应根评论的回复
            commentList.value.forEach(async (comment, index) => {
              if (comment.answers.some((ans) => ans.id === commentId)) {
                comment.loadedAnswerCount = 0
                comment.currentOffset = 0
                comment.isExpanded = true
                comment.answers = []
                await loadAnswers(index)
              }
            })
          }
        } catch (error) {
          console.error('删除评论失败：', error)
          uni.showToast({
            title: (error as Error).message || '删除失败，无操作权限',
            icon: 'none',
          })
        }
      }
    },
  })
}

// 时间格式化
const formatTime = (timeStr: string) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// Markdown处理
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

const renderMarkdown = async (content: string): Promise<string> => {
  if (!content) return ''
  const tocItems = extractToc(content)
  const titleMap = new Map(tocItems.map((item) => [item.title, item.id]))

  let html = await marked.parse(content)
  html = `<div class="markdown-body">${html}</div>`

  html = html
    .replace(/<h1>(.*?)<\/h1>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h1-${Date.now()}`
      return `<h1 id="${id}" class="md-h1">${title}</h1>`
    })
    .replace(/<h2>(.*?)<\/h2>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h2-${Date.now()}`
      return `<h2 id="${id}" class="md-h2">${title}</h2>`
    })
    .replace(/<h3>(.*?)<\/h3>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h3-${Date.now()}`
      return `<h3 id="${id}" class="md-h3">${title}</h3>`
    })
    .replace(/<h4>(.*?)<\/h4>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h4-${Date.now()}`
      return `<h4 id="${id}" class="md-h4">${title}</h4>`
    })
    .replace(/<h5>(.*?)<\/h5>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h5-${Date.now()}`
      return `<h5 id="${id}" class="md-h5">${title}</h5>`
    })
    .replace(/<h6>(.*?)<\/h6>/g, (match, title) => {
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

// 页面生命周期
onLoad((options: any) => {
  // 优先初始化用户ID
  initCurrentUserId()

  if (options.id) {
    formData.id = options.id
    formData.knowledge_base_id = options.kbId || ''
    fetchNodeDetail(options.id)
  }
})

onMounted(() => {
  // 兜底：如果onLoad中没初始化成功，再执行一次
  if (!currentUserId.value) {
    initCurrentUserId()
  }
})

const fetchNodeDetail = async (id: string) => {
  try {
    const res = await getKnowledgeNodeDetail(id)
    formData.name = res.name
    formData.content = res.content
    formData.description = res.description
    formData.knowledge_base_id = res.knowledge_base_id
    renderedContent.value = await renderMarkdown(formData.content)
  } catch (error) {
    uni.showToast({ title: '加载详情失败', icon: 'none' })
    console.error(error)
  }
}

const toEdit = () => {
  uni.navigateTo({
    url: `/pagesMember/knowledge/editNode/editNode?id=${formData.id}&type=edit&kbId=${formData.knowledge_base_id}`,
  })
}

// 下拉刷新：重新拉取文章详情与根评论
onPullDownRefresh(async () => {
  try {
    if (formData.id) {
      await fetchNodeDetail(formData.id)
    }
    await fetchRootComments()
  } finally {
    uni.stopPullDownRefresh()
  }
})

</script>

<style scoped lang="scss">
page {
  padding: 0;
  margin: 0;
  height: 100%;
  box-sizing: border-box;
}

.node-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  position: relative;
}

// 悬浮按钮组
.float-btn-group {
  position: fixed;
  right: 30rpx;
  bottom: 100rpx;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  align-items: center;
}

.float-btn-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  row-gap: 10rpx;

  .icon-content {
    position: relative;
    margin: 0 10rpx;

    .tooltip {
      position: absolute;
      top: 50%;
      right: 80rpx;
      transform: translateY(-50%);
      color: #fff;
      padding: 8rpx 15rpx;
      border-radius: 20rpx;
      opacity: 0;
      visibility: hidden;
      font-size: 24rpx;
      background-color: rgba(0, 0, 0, 0.7);
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    &.icon-hover .tooltip {
      opacity: 1;
      visibility: visible;
    }

    .btn-inner {
      position: relative;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 80rpx;
      height: 80rpx;
      border-radius: 50%;
      color: #4d4d4d;
      background-color: #fff;
      transition: all 0.3s ease-in-out;
      box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.1);

      .filled {
        position: absolute;
        top: auto;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 0;
        background-color: #000000;
        transition: all 0.3s ease-in-out;
      }

      // 新增图标样式，确保图片适配按钮大小
      .icon-img {
        position: relative;
        z-index: 1;
        width: 40rpx;
        height: 40rpx;
      }
    }

    &.icon-hover .btn-inner {
      box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.15);
      color: white;

      .filled {
        height: 100%;
      }
    }
  }
}

// 内容区域
.content-scroll {
  flex: 1;
  padding: 20rpx 30rpx;
  padding-right: env(safe-area-inset-right) !important;
  padding-left: env(safe-area-inset-left) !important;
  overflow-y: auto;
  box-sizing: border-box;
}

.detail-container {
  background-color: #ffffff;
  padding: 30rpx;
  border-radius: 16rpx;
  border: 1rpx solid #f3f3f3;
  width: 100%;
  box-sizing: border-box;
}

.detail-title {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
  color: #111;
}

.detail-content {
  font-size: 28rpx;
  color: #222;
  line-height: 1.75;
  margin-bottom: 20rpx;
}

// Markdown样式
.markdown-body {
  width: 100%;
  box-sizing: border-box;
  line-height: 1.85;
  font-size: 28rpx;
  color: #222;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.md-h1 {
  font-size: 36rpx;
  font-weight: 700;
  margin: 30rpx 0 15rpx;
  padding-bottom: 10rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.md-h2 {
  font-size: 32rpx;
  font-weight: 600;
  margin: 25rpx 0 10rpx;
  padding-bottom: 8rpx;
  border-bottom: 1rpx solid #fafafa;
}

.md-h3 {
  font-size: 28rpx;
  font-weight: 600;
  margin: 20rpx 0 10rpx;
}

.md-h4 {
  font-size: 26rpx;
  font-weight: 600;
  margin: 18rpx 0 8rpx;
}

.md-h5 {
  font-size: 24rpx;
  font-weight: 600;
  margin: 15rpx 0 8rpx;
}

.md-h6 {
  font-size: 22rpx;
  font-weight: 600;
  color: #666;
  margin: 15rpx 0 8rpx;
}

.md-p {
  margin: 15rpx 0;
}

.md-ul,
.md-ol {
  margin: 15rpx 0;
  padding-left: 40rpx;
}

.md-pre {
  margin: 20rpx 0;
  overflow-x: auto;
  background: #fbfbfb;
  border: 1rpx solid #f3f3f3;
  padding: 20rpx;
  border-radius: 10rpx;
}

.md-code {
  padding: 4rpx 8rpx;
  border-radius: 6rpx;
  background-color: #f6f6f6;
  color: #c7254e;
  font-size: 24rpx;
}

// 评论区样式
.comment-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9998;
}

.comment-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 750rpx;
  max-width: 100%;
  height: 80%;
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
  z-index: 9999;
  transform: translateY(100%);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  &.show {
    transform: translateY(0);
  }

  // 评论头部
  .comment-header {
    padding: 20rpx 30rpx;
    border-bottom: 1rpx solid #f5f5f5;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .comment-title {
      font-size: 30rpx;
      font-weight: 600;
      color: #333;
    }

    .close-btn {
      font-size: 36rpx;
      color: #666;
      width: 60rpx;
      height: 60rpx;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }

  // 评论列表
  .comment-list {
    flex: 1;
    padding: 20rpx 30rpx;
    overflow-y: auto;
    box-sizing: border-box;

    .empty-comment,
    .loading-comment {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300rpx;

      .empty-text,
      .loading-text {
        font-size: 26rpx;
        color: #999;
      }
    }

    // 根评论项
    .root-comment-item {
      margin-bottom: 30rpx;
      width: 100%;
      box-sizing: border-box;

      .comment-main {
        margin-bottom: 15rpx;

        .comment-user-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10rpx;

          .user-time-wrap {
            display: flex;
            align-items: center;
            gap: 10rpx;
          }

          .username {
            font-size: 28rpx;
            font-weight: 600;
            color: #333;
          }

          .comment-time {
            font-size: 22rpx;
            color: #999;
          }
        }

        .comment-content {
          font-size: 28rpx;
          color: #333;
          line-height: 1.6;
          margin-bottom: 10rpx;
          word-wrap: break-word;
        }

        .comment-actions {
          display: flex;
          gap: 20rpx;
          align-items: center;
          flex-wrap: wrap;

          .reply-btn {
            font-size: 24rpx;
            color: #007aff;
            display: flex;
            align-items: center;
          }

          .delete-btn {
            font-size: 24rpx;
            color: #ff4444;
            padding: 6rpx 12rpx;
            border-radius: 12rpx;
            background-color: #fff5f5;
          }

          .expand-btn {
            font-size: 24rpx;
            color: #999;
            padding: 6rpx 12rpx;
            border-radius: 12rpx;
            background-color: #f5f5f5;
            cursor: pointer;
          }
        }
      }

      .reply-input-wrap {
        margin: 15rpx 0 20rpx;
        padding: 15rpx;
        background-color: #f9f9f9;
        border-radius: 12rpx;

        .reply-input {
          width: 100%;
          min-height: 100rpx;
          padding: 10rpx;
          font-size: 28rpx;
          border: 1rpx solid #e5e5e5;
          border-radius: 8rpx;
          background-color: #fff;
          box-sizing: border-box;
        }

        .reply-btn-group {
          display: flex;
          justify-content: flex-end;
          gap: 15rpx;
          margin-top: 15rpx;

          .cancel-btn {
            font-size: 26rpx;
            color: #666;
            padding: 8rpx 20rpx;
            border-radius: 12rpx;
            background-color: #f0f0f0;
          }

          .send-btn {
            font-size: 26rpx;
            color: #fff;
            padding: 8rpx 20rpx;
            border-radius: 12rpx;
            background-color: #007aff;

            &.disabled {
              background-color: #cccccc;
              color: #999;
              pointer-events: none;
            }
          }
        }
      }

      .answer-loading {
        padding: 10rpx 0;
        font-size: 24rpx;
        color: #999;
        text-align: center;
      }

      .no-answers {
        padding: 10rpx 0;
        font-size: 24rpx;
        color: #999;
        text-align: center;
      }

      .no-more-answers {
        padding: 10rpx 0;
        font-size: 22rpx;
        color: #ccc;
        text-align: center;
      }

      // 回复列表
      .answer-comment-list {
        padding-left: 40rpx;
        margin-top: 10rpx;

        .answer-comment-item {
          margin-bottom: 20rpx;
          padding: 15rpx;
          background-color: #f9f9f9;
          border-radius: 12rpx;

          .answer-user-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8rpx;

            .user-time-wrap {
              display: flex;
              align-items: center;
              gap: 8rpx;
            }

            .answer-username {
              font-size: 26rpx;
              font-weight: 600;
              color: #333;
            }

            .answer-time {
              font-size: 20rpx;
              color: #999;
            }
          }

          .answer-content {
            font-size: 26rpx;
            color: #333;
            line-height: 1.5;
            margin-bottom: 10rpx;
            word-wrap: break-word;
          }

          .answer-actions {
            display: flex;
            gap: 15rpx;
            align-items: center;

            .reply-btn {
              font-size: 22rpx;
              color: #007aff;
            }

            .delete-btn {
              font-size: 22rpx;
              color: #ff4444;
              padding: 4rpx 10rpx;
              border-radius: 10rpx;
              background-color: #fff5f5;
            }
          }
        }
      }
    }
  }

  // 底部评论输入框
  .add-comment-wrap {
    padding: 20rpx 30rpx;
    border-top: 1rpx solid #f5f5f5;
    display: flex;
    flex-direction: column;
    gap: 15rpx;

    .comment-input {
      width: 100%;
      min-height: 100rpx;
      padding: 15rpx;
      font-size: 28rpx;
      border: 1rpx solid #e5e5e5;
      border-radius: 12rpx;
      background-color: #f9f9f9;
      box-sizing: border-box;
    }

    .send-comment-btn {
      align-self: flex-end;
      font-size: 28rpx;
      color: #fff;
      padding: 10rpx 30rpx;
      border-radius: 20rpx;
      background-color: #007aff;

      &.disabled {
        background-color: #cccccc;
        color: #999;
        pointer-events: none;
      }
    }
  }
}
</style>
