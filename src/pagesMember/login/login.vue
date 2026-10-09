<template>
  <view class="login-page">
    <!-- 主容器 -->
    <view class="login-container">
      <!-- 头部区域 -->
      <view class="header-section">
        <view class="logo-section">
          <!-- 应用图标 -->
          <image
            src="https://youupro.xyz/notes/static/logo.png"
            class="app-logo"
            mode="widthFix"
          ></image>
        </view>
        <text class="welcome-text">欢迎回来</text>
      </view>

      <!-- 登录表单 -->
      <view class="login-form">
        <!-- 用户名输入 -->
        <view class="input-wrapper">
          <view
            class="input-container"
            :class="{ error: usernameError, focused: usernameFocused }"
          >
            <image
              src="https://youupro.xyz/notes/static/icons/portrait.png"
              class="username-icon"
              mode="widthFix"
            />
            <input
              type="text"
              v-model="username"
              placeholder="请输入用户名"
              class="input-field"
              @input="handleInput"
              @focus="usernameFocused = true"
              @blur="usernameFocused = false"
            />
          </view>
          <text
            v-if="usernameError"
            class="error-message"
          >
            {{ usernameError }}
          </text>
        </view>

        <!-- 密码输入 -->
        <view class="input-wrapper">
          <view
            class="input-container"
            :class="{ error: passwordError, focused: passwordFocused }"
          >
            <image
              src="https://youupro.xyz/notes/static/icons/password.png"
              class="password-icon"
              mode="widthFix"
            />
            <input
              type="text"
              :password="true"
              v-model="password"
              placeholder="请输入密码"
              class="input-field"
              @input="handleInput"
              @focus="passwordFocused = true"
              @blur="passwordFocused = false"
            />
          </view>
          <text
            v-if="passwordError"
            class="error-message"
          >
            {{ passwordError }}
          </text>
        </view>

        <!-- 登录按钮 -->
        <button
          class="login-button"
          @click="handleLogin"
          :disabled="!canLogin || isLoading"
          :class="{ loading: isLoading }"
        >
          <text
            v-if="isLoading"
            class="loading-text"
          >
            登录中...
          </text>
          <text v-else>登录</text>
        </button>

        <!-- 分割线 -->
        <view class="divider">
          <view class="divider-line"></view>
          <text class="divider-text">或</text>
          <view class="divider-line"></view>
        </view>

        <!-- 微信登录 -->
        <button
          class="wechat-button"
          @click="wxLogin"
          :disabled="isLoading"
        >
          <image
            src="https://youupro.xyz/notes/static/icons/wx.png"
            class="wechat-icon"
            mode="widthFix"
          />
          <text>微信登录</text>
        </button>

        <!-- 底部链接 -->
        <view class="footer-links">
          <text
            class="link"
            @click="navigateToRegister"
          >
            创建账户
          </text>
          <text
            class="link"
            @click="navigateToForgot"
          >
            忘记密码？
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { syncLoginState } from '@/pages/my/my'

// ========== 类型定义 ==========
/** 通用登录返回数据结构 */
interface LoginResponse {
  code: number
  msg: string
  data: {
    user_id: string
    username: string
    access: string // 通用accessToken
    refresh: string // 通用refreshToken
    openid?: string // 仅微信登录返回
    userInfo: {
      userId: string
      username: string
      loginType: 'wechat' | 'password'
    }
  }
}

/** JWT Token结构（适配旧接口） */
interface JWTResponse {
  access: string
  refresh: string
}

/** 用户信息结构 */
interface UserInfo {
  id: number | string
  username: string
  loginType?: 'wechat' | 'password'
}

// ========== 响应式数据 ==========
const username = ref('')
const password = ref('')
const isLoading = ref(false)
const usernameError = ref('')
const passwordError = ref('')
const usernameFocused = ref(false)
const passwordFocused = ref(false)

// ========== 验证逻辑 ==========
const validateUsername = (): boolean => {
  const value = username.value.trim()
  if (!value) {
    usernameError.value = '用户名不能为空'
    return false
  }
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]{2,20}$/.test(value)) {
    usernameError.value = '用户名需为2-20位字母、数字、汉字或下划线'
    return false
  }
  usernameError.value = ''
  return true
}

const validatePassword = (): boolean => {
  const value = password.value.trim()
  if (!value) {
    passwordError.value = '密码不能为空'
    return false
  }
  if (value.length < 8) {
    passwordError.value = '密码长度不能少于8位'
    return false
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    passwordError.value = '密码需包含字母和数字'
    return false
  }
  passwordError.value = ''
  return true
}

// ========== 计算属性 ==========
const canLogin = computed((): boolean => {
  return validateUsername() && validatePassword() && !isLoading.value
})

// ========== 事件处理 ==========
const handleInput = (): void => {
  validateUsername()
  validatePassword()
}

/** 账号密码登录（仅存储通用Token） */
const handleLogin = async (): Promise<void> => {
  if (!validateUsername() || !validatePassword()) return
  if (!canLogin.value) return

  isLoading.value = true
  try {
    // 调用统一的密码登录接口
    const res = await uni.request({
      url: 'http://localhost:8000/api/v1/auth/password/login/',
      method: 'POST',
      data: {
        username: username.value.trim(),
        password: password.value.trim(),
      },
      header: {
        'Content-Type': 'application/json',
      },
    })

    const response = Array.isArray(res) ? res[1] : res
    if (response.statusCode !== 200) {
      throw new Error('账号或密码错误')
    }

    const loginData = response.data as LoginResponse
    if (loginData.code !== 200) {
      throw new Error(loginData.msg || '登录失败')
    }

    // 仅存储通用Token和用户信息（删除所有专属Token）
    uni.setStorageSync('accessToken', loginData.data.access)
    uni.setStorageSync('refreshToken', loginData.data.refresh)
    uni.setStorageSync('userInfo', loginData.data.userInfo)

    // 登录成功提示并跳转
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      syncLoginState() // 同步登录状态到 my 页面
      // 知识库已不再是 tabBar 页面，登录后回到首页
      uni.switchTab({ url: '/pages/index/index' })
    }, 1500)
  } catch (err) {
    console.error('登录失败：', err)
    uni.showToast({
      title: err instanceof Error ? err.message : '登录失败，请重试',
      icon: 'none',
    })
  } finally {
    isLoading.value = false
  }
}

/** 微信登录（仅存储通用Token） */
const wxLogin = async (): Promise<void> => {
  isLoading.value = true
  const REQUEST_TIMEOUT = 10000

  try {
    // 1. 获取微信code
    // withCredentials ，兼容开发者工具/真机
    const loginRes = await uni.login({
      provider: 'weixin',
      timeout: REQUEST_TIMEOUT,
      withCredentials: true, // 开发者工具登录兼容
    })

    // 更严谨的code校验
    if (!loginRes || loginRes.errMsg !== 'login:ok' || !loginRes.code) {
      const errMsg = loginRes?.errMsg || '未知错误'
      console.error('【登录步骤1】获取微信code失败：', errMsg, loginRes)
      throw new Error(`获取微信登录凭证失败：${errMsg}`)
    }
    console.log('登录-获取code成功：', loginRes.code)

    // 2. 调用后端微信登录接口
    // 直接接收响应对象
    const response = await uni.request({
      url: 'http://localhost:8000/api/v1/auth/wechat/mini/login/',
      method: 'POST',
      timeout: REQUEST_TIMEOUT,
      header: {
        'Content-Type': 'application/json',
      },
      data: {
        code: loginRes.code,
      },
    })

    // 3. 校验响应（ 正确解析响应）
    console.log('登录-接口完整响应：', response) // 打印完整响应，定位400原因
    // 正确判断HTTP状态码
    if (response.statusCode !== 200) {
      // 重点：打印400/500等错误的响应体，看后端返回的具体原因
      console.error('【登录步骤2】接口返回非200状态：', response.statusCode, response.data)
      throw new Error(
        `接口请求失败：${response.statusCode} - ${JSON.stringify(response.data || '无错误信息')}`,
      )
    }

    const wxData = response.data as LoginResponse
    if (wxData.code !== 200) {
      console.error('【登录步骤2】业务逻辑失败：', wxData)
      throw new Error(wxData.msg || '微信登录失败，请重试')
    }

    if (!wxData.data || !wxData.data.openid) {
      throw new Error('获取微信OpenId失败')
    }

    // 4. 存储Token和用户信息
    uni.setStorageSync('accessToken', wxData.data.access)
    uni.setStorageSync('refreshToken', wxData.data.refresh)
    uni.setStorageSync('userOpenId', wxData.data.openid)
    uni.setStorageSync('userInfo', wxData.data.userInfo)

    // 登录成功提示并跳转
    uni.showToast({
      title: '微信登录成功',
      icon: 'success',
      duration: 1500,
    })

    setTimeout(async () => {
      syncLoginState() // 同步登录状态到 my 页面
      try {
        // 知识库已不再是 tabBar 页面，登录后回到首页
        await uni.switchTab({
          url: '/pages/index/index',
          fail: (jumpErr) => {
            console.error('页面跳转失败：', jumpErr)
            uni.redirectTo({ url: '/pages/index/index' })
          },
        })
      } catch (jumpErr) {
        console.error('页面跳转异常：', jumpErr)
        uni.showToast({ title: '跳转失败，已返回首页', icon: 'none' })
        uni.redirectTo({ url: '/pages/index/index' })
      }
    }, 1500)
  } catch (err) {
    // 更精准的错误信息输出
    const errorMsg = err instanceof Error ? err.message : '微信登录失败，请重试'
    console.error('【登录异常】', errorMsg, err)
    uni.showToast({
      title: errorMsg,
      icon: 'none',
      duration: 2000,
    })
  } finally {
    isLoading.value = false
  }
}

/** 跳转到注册页面 */
const navigateToRegister = (): void => {
  uni.navigateTo({
    url: '/pagesMember/register/register',
  })
}

/** 跳转到忘记密码页面 */
const navigateToForgot = (): void => {
  uni.navigateTo({
    url: '/pagesMember/forgot/forgot',
  })
}

// ========== 全局请求拦截器（仅读取通用Token） ==========
const setupRequestInterceptor = () => {
  // 请求拦截：自动携带通用accessToken
  uni.addInterceptor('request', {
    invoke(config) {
      const accessToken = uni.getStorageSync('accessToken')
      if (accessToken) {
        config.header = {
          ...config.header,
          Authorization: `JWT ${accessToken}`,
        }
      }
    },
    fail(err) {
      console.error('请求拦截失败：', err)
    },
  })

  // 响应拦截：处理Token过期
  uni.addInterceptor('response', {
    invoke(response) {
      const res = Array.isArray(response) ? response[1] : response
      if (res.statusCode === 401) {
        // 清空通用Token并跳转登录页
        uni.removeStorageSync('accessToken')
        uni.removeStorageSync('refreshToken')
        uni.removeStorageSync('userInfo')
        uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
        uni.redirectTo({ url: '/pagesMember/login/login' })
      }
    },
    fail(err) {
      console.error('响应拦截失败：', err)
    },
  })
}

// ========== 生命周期 ==========
onMounted(() => {
  // 初始化请求拦截器
  setupRequestInterceptor()
})
</script>

<style scoped lang="scss">
// 主题变量
$primary-color: #3b82f6;
$secondary-color: #60a5fa;
$accent-color: #93c5fd;
$error-color: #ef4444;
$success-color: #10b981;

// 浅色主题（仅保留浅色模式）
$text-primary-light: #1f2937;
$text-secondary-light: #6b7280;
$text-tertiary-light: #9ca3af;
$bg-primary-light: #ffffff;
$bg-secondary-light: #f8fafc;
$bg-tertiary-light: #f1f5f9;
$border-light: #e5e7eb;
$shadow-light: 0 4rpx 24rpx rgba(59, 130, 246, 0.08);
$shadow-medium-light: 0 8rpx 32rpx rgba(59, 130, 246, 0.12);

// 通用按钮样式抽离（统一宽度/圆角/对齐）
$btn-width: 400rpx; // 统一按钮宽度，可根据需求调整
$btn-radius: 60rpx; // 大圆角，实现全圆边效果
$btn-height: 88rpx; // 统一按钮高度

// 通用变量
$border-radius: 16rpx;
$border-radius-large: 24rpx;
$transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

.login-page {
  min-height: 100vh;
  padding: 40rpx 24rpx;
  transition: $transition;
  // 仅保留浅色模式背景
  background: linear-gradient(135deg, $bg-secondary-light 0%, $bg-tertiary-light 100%);
}

// 主容器
.login-container {
  max-width: 560rpx;
  margin: 0 auto;
  // 核心修改：添加顶部外边距，拉开和上边界的距离
  margin-top: 80rpx; // 可根据视觉需求调整（80rpx~160rpx 都合适）
  transition: $transition;
  // 浅色模式
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20rpx);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-radius: $border-radius-large;
  padding: 48rpx 32rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);
}

// 头部区域
.header-section {
  text-align: center;
  margin-bottom: 48rpx;
}

.logo-section {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.logo-icon {
  font-size: 48rpx;
  margin-right: 16rpx;
}

.brand-name {
  font-size: 36rpx;
  font-weight: 700;
  letter-spacing: -1rpx;
  color: $text-primary-light;
}

// 应用logo
.app-logo {
  width: 240rpx;
  height: 240rpx;
  margin-top: 60rpx; // 图片向下偏移的距离（可调整30-80rpx）
  margin-bottom: 10rpx; // 拉近和“欢迎回来”的距离，可根据需要再调整（10-30rpx区间）
  border-radius: 50%;
}

.welcome-text {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
  color: $text-primary-light;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  font-weight: 400;
  color: $text-secondary-light;
}

// 表单区域
.login-form {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

// 输入框容器
.input-wrapper {
  position: relative;
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
  transition: $transition;
  background: $bg-secondary-light;
  border: 2rpx solid $border-light;
  border-radius: $border-radius;
  padding: 20rpx 24rpx;
  min-height: 30rpx;

  &.focused {
    border-color: $primary-color;
    box-shadow: 0 0 0 4rpx rgba(59, 130, 246, 0.1);
  }

  &.error {
    border-color: $error-color;
    box-shadow: 0 0 0 4rpx rgba(239, 68, 68, 0.1);
  }
}

.input-icon {
  font-size: 28rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.username-icon {
  width: 32rpx;
  height: 32rpx;
}

.password-icon {
  width: 32rpx;
  height: 32rpx;
}

.input-field {
  flex: 1;
  font-size: 28rpx;
  border: none;
  outline: none;
  background: transparent;
  color: $text-primary-light;

  &::placeholder {
    color: $text-tertiary-light;
  }
}

.error-message {
  display: block;
  font-size: 24rpx;
  color: $error-color;
  margin-top: 8rpx;
  margin-left: 8rpx;
}

// 登录按钮
.login-button {
  width: $btn-width; // 固定宽度，和微信按钮一致
  height: $btn-height; // 固定高度
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  border: none;
  border-radius: $btn-radius; // 全圆角
  font-size: 32rpx;
  font-weight: 1000;
  color: white !important; // 强制白色文字
  transition: $transition;
  box-shadow: 0 8rpx 24rpx rgba(59, 130, 246, 0.2);
  margin-top: 16rpx;
  display: flex; // 子元素居中
  align-items: center;
  justify-content: center;

  &:active:not(:disabled) {
    transform: translateY(2rpx);
    box-shadow: 0 4rpx 16rpx rgba(59, 130, 246, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.loading {
    pointer-events: none;
  }
}

// 加载文字样式
.loading-text {
  display: flex;
  color: #ffffff !important;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  font-size: 32rpx;
  font-weight: 1000;

  &::before {
    content: '';
    width: 24rpx;
    height: 24rpx;
    border: 2rpx solid rgb(255, 255, 255);
    border-top: 2rpx solid transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

.loading-text {
  display: flex;
  color: #ffffff;
  align-items: center;
  justify-content: center;
  gap: 12rpx;

  &::before {
    content: '';
    width: 24rpx;
    height: 24rpx;
    border: 2rpx solid rgb(255, 255, 255);
    border-top: 2rpx solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

// 旋转动画
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 分割线容器（调小上下边距，让按钮更靠近）
.divider {
  display: flex;
  align-items: center;
  // 原边距：margin: 32rpx 0 24rpx; 已减半为 16rpx 0 12rpx
  // 进一步缩小：改为 8rpx 0 6rpx，让分割线和上下按钮更靠近
  margin: 8rpx 0 6rpx;
}

.divider-line {
  flex: 1;
  height: 1rpx;
  // 可选优化：给分割线加一点透明度，视觉上更柔和，不突兀
  opacity: 0.8;
  background: $border-light;
}

.divider-text {
  padding: 0 24rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: $text-secondary-light;
}

// 微信登录按钮
.wechat-button {
  width: $btn-width; // 和登录按钮统一宽度
  height: $btn-height; // 统一高度
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  background: #07c160;
  border: none;
  border-radius: $btn-radius; // 全圆角
  font-size: 32rpx;
  font-weight: 1000;
  color: white !important; // 强制白色文字
  transition: $transition;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.2);

  &:active:not(:disabled) {
    transform: translateY(2rpx);
    box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// 微信图标样式
.wechat-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0; // 防止图标压缩
}

// 底部链接
.footer-links {
  display: flex;
  justify-content: space-between;
  margin-top: 24rpx;
}

.link {
  font-size: 24rpx;
  font-weight: 500;
  transition: $transition;
  color: $primary-color;

  &:active {
    opacity: 0.7;
  }
}

// 响应式设计
@media (max-width: 750rpx) {
  .login-page {
    padding: 20rpx 16rpx;
  }

  .login-container {
    padding: 32rpx 24rpx;
  }
}
</style>
