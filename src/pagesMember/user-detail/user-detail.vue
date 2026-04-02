<template>
  <view class="user-detail-page">
    <!-- 加载状态（增加简单动画动画） -->
    <view
      v-if="loading"
      class="loading"
    >
      <text class="loading-text">加载中</text>
      <view class="loading-dots">
        <view class="dot"></view>
        <view class="dot"></view>
        <view class="dot"></view>
      </view>
    </view>

    <!-- 错误提示 -->
    <view
      v-else-if="error"
      class="error"
    >
      <text class="error-icon">errMsg:</text>
      <text class="error-text">{{ error }}</text>
    </view>

    <!-- 用户详情内容 -->
    <view
      v-else
      class="user-container"
    >
      <!-- 重构：参考my.vue的顶部渐变背景+立体化用户信息卡片 -->
      <view
        class="top-section"
        :style="{ background: headerGradientBg }"
      >
        <!-- 用户头部信息 - 立体化卡片设计 -->
        <view class="user-card">
          <view class="user-avatar-section">
            <view class="avatar-wrapper">
              <!-- 核心修改：根据是否有头像显示图片或文字头像 -->
              <view
                class="avatar avatar-text"
                :style="{ backgroundColor: avatarColor }"
                v-if="!userInfo.avatar || userInfo.avatar === ''"
              >
                <text>{{ getAvatarText }}</text>
              </view>
              <image
                class="avatar avatar-img"
                :src="userInfo.avatar"
                mode="aspectFill"
                v-else
              ></image>
              <view class="avatar-glow"></view>
            </view>
            <view class="user-basic-info">
              <text class="username">{{ userInfo.username || '未知用户' }}</text>
              <text class="user-id">{{ userInfo.user_id }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 用户详细信息 - 立体化卡片调整 + 折叠效果 -->
      <view class="collapse-container">
        <!-- 折叠/展开触发区域 - 替换按钮样式类为effect-btn -->
        <view
          class="collapse-trigger effect-btn"
          @click="toggleCollapse('info')"
        >
          <text class="btn-text">用户信息</text>
        </view>
        <!-- 折叠内容容器 -->
        <view
          class="collapse-content"
          :class="{ collapsed: !isInfoExpanded }"
        >
          <view class="user-detail-info card-style">
            <view class="info-item">
              <text class="label">邮箱：</text>
              <text class="value">{{ userInfo.email || '未填写' }}</text>
            </view>
            <view class="info-item">
              <text class="label">性别：</text>
              <text class="value">{{ formatGender(userInfo.gender_text) }}</text>
            </view>
            <view class="info-item">
              <text class="label">关注数：</text>
              <text class="value">{{ userInfo.following_count || 0 }}</text>
            </view>
            <view class="info-item">
              <text class="label">粉丝数：</text>
              <text class="value">{{ userInfo.follower_count || 0 }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 该用户的公开知识库列表 - 立体化卡片调整 + 折叠效果 -->
      <view class="collapse-container">
        <!-- 折叠/展开触发区域 -  替换按钮样式类为effect-btn -->
        <view
          class="collapse-trigger effect-btn"
          @click="toggleCollapse('docs')"
        >
          <text class="btn-text">公开知识库</text>
        </view>
        <!-- 折叠内容容器 -->
        <view
          class="collapse-content"
          :class="{ collapsed: !isDocsExpanded }"
        >
          <view class="user-documents card-style">
            <view
              v-if="userDocs.length > 0"
              class="doc-list"
            >
              <view
                class="doc-item"
                v-for="doc in userDocs"
                :key="doc.id"
                @click="viewDoc(doc)"
              >
                <text class="doc-title">{{ doc.name }}</text>
                <text class="doc-summary">{{ doc.description || '' }}</text>
              </view>
            </view>
            <!-- 知识库为空时的提示 -->
            <view
              v-else
              class="empty-docs"
            >
              <text>暂无公开知识库</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, getCurrentInstance } from 'vue'
import { baseURL } from '../../utils/request'
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app' // 新增导入分享函数

// 定义类型接口
interface UserInfo {
  user_id: string
  username?: string
  email?: string
  gender_text?: string
  following_count?: number
  follower_count?: number
  avatar?: string // 添加头像字段
  avatar_text?: string // 添加头像字段, 但是我们没有用到，还是使用逻辑实现的
}

// 替换原有Document接口为公开知识库接口（匹配后端返回字段）
interface KnowledgeBase {
  id: string
  short_id: string
  name: string
  description: string
  is_public: boolean
  creator_username: string
  created_at: string
  updated_at: string
}

// 页面参数 - 核心修复：使用 onLoad 获取参数（UniApp 小程序唯一可靠方式）
let userId = ''
let username = ''

// 获取当前实例，用于访问页面生命周期
const instance = getCurrentInstance()

// 核心修复：在 onLoad 中获取参数（必须在 setup 顶层调用）
if (instance) {
  const originalOnLoad = instance.proxy?.$options.onLoad
  instance.proxy!.$options.onLoad = function (options: Record<string, string | undefined>) {
    console.log('跳转参数原始值：', options) // 调试用

    try {
      // 1. 解码参数（跳转时用了 encodeURIComponent，接收时必须解码）
      const rawUserId = options.userId || options.user_id || ''
      const rawUsername = options.username || ''

      userId = rawUserId ? decodeURIComponent(rawUserId) : ''
      username = rawUsername ? decodeURIComponent(rawUsername) : ''

      // 2. 校验 userId 非空后加载用户详情
      if (userId) {
        loadUserDetail()
      } else {
        error.value = '用户ID为空，无法加载详情'
        console.error('用户ID为空：', options)
      }
    } catch (e) {
      console.error('解析跳转参数失败：', e)
      error.value = '参数解析失败，请重试'
    }

    // 调用原有的 onLoad（如果有）
    if (originalOnLoad) {
      originalOnLoad.call(this, options)
    }
  }
}

// 响应式数据
const loading = ref(true)
const error = ref('')
const userInfo = ref<UserInfo>({
  user_id: '',
  username: '',
  avatar: '', // 初始化头像字段为空
})
// 修改类型为公开知识库数组
const userDocs = ref<KnowledgeBase[]>([])

// 折叠状态控制
const isInfoExpanded = ref(true) // 用户信息是否展开
const isDocsExpanded = ref(true) // 知识库是否展开

// 折叠/展开切换方法
const toggleCollapse = (type: 'info' | 'docs') => {
  if (type === 'info') {
    isInfoExpanded.value = !isInfoExpanded.value
  } else {
    isDocsExpanded.value = !isDocsExpanded.value
  }
}

// 抽离请求头配置
const getHeaders = () => ({
  Authorization: `JWT ${uni.getStorageSync('accessToken') || ''}`,
  'Content-Type': 'application/json',
})

//  结合username和user_id生成哈希，生成单头像背景色
const avatarColor = computed(() => {
  // 组合username和user_id生成哈希
  const combinedStr = (userInfo.value.username || 'default') + (userInfo.value.user_id || '0000')
  let hash = 0
  for (let i = 0; i < combinedStr.length; i++) {
    hash = combinedStr.charCodeAt(i) + ((hash << 5) - hash)
  }
  // 生成 pastel 风格颜色
  const color = `hsl(${hash % 360}, 70%, 80%)`
  return color
})

// 结合username和user_id生成渐变背景（用于顶部区域）
const headerGradientBg = computed(() => {
  // 组合username和user_id生成两个不同的哈希值
  const combinedStr = (userInfo.value.username || 'default') + (userInfo.value.user_id || '0000')
  let hash1 = 0,
    hash2 = 0
  for (let i = 0; i < combinedStr.length; i++) {
    hash1 = combinedStr.charCodeAt(i) + ((hash1 << 5) - hash1)
    hash2 = combinedStr.charCodeAt(i + 1 || 0) + ((hash2 << 5) - hash2) // 偏移一位生成第二个哈希
  }
  // 生成两个不同的色调，差值60度保证渐变效果
  const hue1 = hash1 % 360
  const hue2 = (hue1 + 60) % 360
  // 生成135度渐变背景
  const gradient = `linear-gradient(135deg, hsl(${hue1}, 70%, 90%), hsl(${hue2}, 70%, 85%))`
  return gradient
})

// 获取头像显示文字
const getAvatarText = computed(() => {
  const username = userInfo.value.username
  return username ? username.substring(0, 1).toUpperCase() : '?'
})

// 格式化性别
const formatGender = (genderText: string | null | undefined) => {
  if (!genderText || genderText === '未填写' || genderText.trim() === '') return '未填写'
  switch (genderText.trim()) {
    case '男':
      return '男'
    case '女':
      return '女'
    case '隐藏':
      return '隐藏'
    default:
      return '未知'
  }
}

// 加载用户详情
const loadUserDetail = async () => {
  await nextTick()

  // 校验 userId 是否为空
  if (!userId || userId.trim() === '') {
    error.value = '用户ID不存在'
    loading.value = false
    console.error('用户ID为空:', userId)
    return
  }

  try {
    // 检查 token
    const token = uni.getStorageSync('accessToken')

    if (!token) {
      error.value = '请先登录'
      loading.value = false
      return
    }

    // 1. 获取用户基本信息（使用新接口）
    const userInfoUrl = `${baseURL}/api/v1/auth/users/user/detail/?param_type=user_id&search_param=${encodeURIComponent(userId)}`
    const userRes = await uni.request({
      url: userInfoUrl,
      method: 'GET',
      header: getHeaders(),
    })

    // 处理接口响应
    if (userRes.statusCode !== 200) {
      error.value = `请求失败：${userRes.statusCode} - ${JSON.stringify(userRes.data)}`
      return
    }

    const userData = userRes.data as any
    if (userData.code === 200 && userData.data) {
      // 映射接口返回的字段
      userInfo.value = {
        user_id: userData.data.user_id,
        username: userData.data.username,
        email: userData.data.email,
        gender_text: userData.data.gender_text,
        following_count: userData.data.following_count,
        follower_count: userData.data.follower_count,
        avatar: userData.data.avatar || '', // 映射头像字段，为空则置空字符串
      } as UserInfo
    } else {
      error.value = '用户信息格式异常'
      return
    }

    // 2. 获取用户的公开知识库列表（替换原有文档接口）
    const kbUrl = `${baseURL}/api/v1/knowledge/user-public-kbs/?user_id=${encodeURIComponent(userId)}`
    const kbRes = await uni.request({
      url: kbUrl,
      method: 'GET',
      header: getHeaders(),
    })

    if (kbRes.statusCode === 200) {
      const kbData = kbRes.data as any
      if (kbData.results) {
        userDocs.value = kbData.results as KnowledgeBase[]
      } else {
        userDocs.value = []
        console.warn('获取公开知识库列表失败', kbData)
      }
    } else {
      console.warn('获取公开知识库列表失败', kbRes.data)
      userDocs.value = []
    }
  } catch (err: any) {
    error.value = `网络异常：${err.errMsg || err.message || '连接失败'}`
    console.error('加载用户详情异常:', err)
  } finally {
    loading.value = false
  }
}

// 查看知识库详情（跳转到知识库节点页面）
const viewDoc = (kb: KnowledgeBase) => {
  // 核心修改：跳转路径改为分包下的showKb页面
  // UniApp页面路径规则：无需src前缀，无需.vue后缀，直接写/pagesMember/xxx/xxx
  uni.navigateTo({
    url: `/pagesMember/knowledge/showKb/showKb?knowledge_base_id=${kb.id}`,
    // 增加跳转失败的容错处理
    fail: (err) => {
      console.error('跳转知识库详情失败:', err)
      uni.showToast({ title: '跳转失败，请返回重试', icon: 'none' })
    },
  })
}

// ========== 新增：微信小程序分享功能 ==========
// 分享给好友（胶囊按钮三点菜单触发）
onShareAppMessage(() => {
  // 动态生成分享标题，优先显示用户名
  const shareTitle = userInfo.value.username
    ? `${userInfo.value.username}的个人主页`
    : '用户个人主页 - 公开知识库分享'
  // 构建分享路径，携带必要的用户参数（编码防止特殊字符）
  const sharePath = `/pagesMember/user/user-detail/user-detail?userId=${encodeURIComponent(userInfo.value.user_id)}&username=${encodeURIComponent(userInfo.value.username || '')}`

  return {
    title: shareTitle,
    path: sharePath,
    imageUrl: 'https://youupro.xyz/notes/static/icons/user-share.png', // 可选：分享卡片图片
    desc: '查看该用户的公开知识库和个人信息', // 可选：分享描述
  }
})

// 分享到朋友圈（胶囊按钮三点菜单触发）
onShareTimeline(() => {
  // 朋友圈分享标题，更具传播性
  const timelineTitle = userInfo.value.username
    ? `快来看看${userInfo.value.username}的公开知识库！`
    : '优质公开知识库分享，值得一看'
  // 分享路径与好友分享保持一致，确保打开相同页面
  const sharePath = `/pagesMember/user/user-detail/user-detail?userId=${encodeURIComponent(userInfo.value.user_id)}&username=${encodeURIComponent(userInfo.value.username || '')}`

  return {
    title: timelineTitle,
    path: sharePath,
    imageUrl: 'https://youupro.xyz/notes/static/icons/user-share.png', // 可选：朋友圈分享图片
  }
})
</script>

<style scoped lang="scss">
// 基础变量（参考my.vue的设计）
$primary-radius: 24rpx;
$medium-radius: 20rpx;
$small-radius: 16rpx;
$shadow-light: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
$shadow-medium: 0 4rpx 24rpx rgba(0, 0, 0, 0.12);
$text-primary: #1f2937;
$text-secondary: #6b7280;
$text-tertiary: #9ca3af;
$white: #ffffff;
$gray-light: #f8fafc;
// 按钮渐变变量 -  添加effect2相关渐变变量
$effect2-gradient1: linear-gradient(315deg, rgba(123, 44, 191, 0.1), rgba(123, 44, 191, 0.05));
$effect2-gradient2: linear-gradient(135deg, rgba(60, 9, 108, 0.1), rgba(60, 9, 108, 0.05));

.user-detail-page {
  padding: 0;
  min-height: 100vh;
  background-color: $gray-light;
  position: relative; // 确保子元素z-index生效
  z-index: 0; // 根容器基础层级
}

/* 加载状态样式 */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
  color: #666;
}

.loading-text {
  font-size: 28rpx;
  margin-bottom: 20rpx;
}

.loading-dots {
  display: flex;
  gap: 10rpx;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background-color: #666;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}
.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* 错误提示样式 */
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 50rpx;
  color: #e53935;
  font-size: 28rpx;
  gap: 10rpx;
}

.error-icon {
  font-size: 32rpx;
}

.user-container {
  min-height: 100vh;
  background-color: transparent;
  padding-bottom: 40rpx;
  position: relative; // 确保子元素z-index生效
  z-index: 1; // 高于根容器
}

// 顶部渐变背景区域 - 拉长背景高度
.top-section {
  position: relative;
  padding: 60rpx 24rpx 120rpx; // 增加底部padding拉长背景
  border-radius: 0 0 $primary-radius $primary-radius;
  margin-bottom: -40rpx; // 负margin实现覆盖层次,调整渐变背景向下面延申到位置
  overflow: hidden;
  z-index: 0; //  设为0，作为最底层背景
}

// 用户卡片立体化样式
.user-card {
  position: relative;
  z-index: 2; // 高于背景
  width: 100%;
  -webkit-tap-highlight-color: transparent;
}

// 头像区域立体化设计
.user-avatar-section {
  display: flex;
  align-items: center;
  background: $white;
  backdrop-filter: blur(20rpx);
  border-radius: $primary-radius;
  padding: 32rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.8);
  box-shadow: $shadow-medium;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  z-index: 3; // 高于用户卡片
  transition: all 0.2s ease;
}

// 头像容器样式
.avatar-wrapper {
  position: relative;
  margin-right: 24rpx;
}

// 头像样式立体化
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid $white;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  margin-right: 0;
}

// 头像光晕效果
.avatar-glow {
  position: absolute;
  top: -4rpx;
  left: -4rpx;
  right: -4rpx;
  bottom: -4rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.2));
  z-index: -1; // 头像内部的底层
}

// 调整：图片头像样式
.avatar-img {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid $white;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  margin-right: 0;
}

// 调整：文字头像样式
.avatar-text text {
  color: #fff;
  font-size: 40rpx;
  font-weight: 600;
}

// 用户基本信息样式调整
.user-basic-info {
  flex: 1;
}

// 调整：用户名样式
.username {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  display: block;
  margin-bottom: 8rpx;
}

// 调整：用户ID样式
.user-id {
  font-size: 28rpx;
  color: $text-secondary;
  font-weight: 500;
  display: block;
  margin-top: 0;
}

// 通用卡片样式（立体化）
.card-style {
  background: $white;
  border-radius: $medium-radius;
  padding: 30rpx;
  box-shadow: $shadow-light;
  margin: 0 24rpx 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  // 增强立体化效果
  transform: translateY(0);
  transition: all 0.3s ease;
  position: relative; // 确保z-index生效
  z-index: 4; // 高于按钮
}

// 调整：用户详情信息区域 - 增强立体化
.user-detail-info {
  margin-bottom: 0;
  position: relative;
  z-index: 4; // 确保覆盖顶部背景
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1); // 增强阴影
}

.info-item {
  display: flex;
  padding: 18rpx 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 28rpx;
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  color: $text-tertiary;
  width: 120rpx;
  font-weight: 500;
}

.value {
  color: $text-secondary;
  flex: 1;
}

// 调整：用户文档区域
.user-documents {
  margin-top: 0;
  position: relative;
  z-index: 4;
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.doc-item {
  padding: 24rpx;
  border-radius: $small-radius;
  background-color: $gray-light;
  transition: all 0.2s ease;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  position: relative; // 确保z-index生效
  z-index: 5; // 高于卡片
}

// 文档项点击效果
.doc-item:active {
  background-color: #f0f0f0;
  transform: translateY(2rpx);
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.04);
}

.doc-title {
  font-size: 28rpx;
  color: $text-primary;
  font-weight: 500;
  display: block;
  line-height: 1.4;
}

.doc-summary {
  font-size: 24rpx;
  color: $text-tertiary;
  margin-top: 8rpx;
  display: block;
  line-height: 1.5;
}

/* 空文档提示 */
.empty-docs {
  text-align: center;
  padding: 40rpx;
  font-size: 26rpx;
  color: $text-tertiary;
  background-color: $gray-light;
  border-radius: $small-radius;
}

// 折叠容器样式
.collapse-container {
  position: relative;
  z-index: 3; // 高于背景，低于卡片
  margin-bottom: 20rpx;
}

// 折叠触发按钮样式
.collapse-trigger {
  position: relative;
  width: calc(100% - 48rpx);
  height: 88rpx;
  line-height: 88rpx;
  margin: 0 24rpx;
  text-align: center;
  font-size: 28rpx;
  color: $text-primary;
  font-weight: 500;
  cursor: pointer;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  z-index: 5; //  设为5，确保按钮在背景上方
}

// 点击效果样式
.effect-btn {
  border-radius: 30rpx; //  增大圆角，使按钮更圆润
  border: 1rpx solid #3c096c;
  background: $white; // 新增：设置按钮背景为纯白色，解决渐变背景侵染问题
  position: relative; // 确保z-index生效
  z-index: 10; // 确保按钮在背景之上
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效

  .dark-mode & {
    border-color: #7b2cbf;
  }

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    width: 0;
    height: 100%;
    transform: skew(15deg);
    transition: all 0.5s;
    overflow: hidden;
    z-index: -1; // 伪元素在按钮之下，背景之上
  }

  &::before {
    left: -10rpx;
    background: $effect2-gradient1;
  }

  &::after {
    right: -10rpx;
    background: $effect2-gradient2;
  }

  &:active::before,
  &:active::after {
    width: 58%;
  }

  &:active .btn-text {
    color: #e0aaff;
    transition: 0.3s;
  }

  .btn-text {
    color: #3c096c;
    transition: all 0.3s ease-in;
    position: relative; // 确保文字在最上层
    z-index: 11;

    .dark-mode & {
      color: #e0aaff;
    }
  }
}

// 折叠内容容器样式
.collapse-content {
  overflow: hidden;
  transition: all 0.5s ease;
  height: auto;
  position: relative; // 确保z-index生效
  z-index: 4; // 高于按钮
}

// 折叠状态样式（仅显示一条线）
.collapse-content.collapsed {
  height: 2rpx;
  margin: 0 24rpx;
  background-color: #e5e7eb;
  border-radius: 1rpx;
  .card-style {
    display: none;
  }
}
</style>
