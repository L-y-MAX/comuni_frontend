<template>
  <view class="vip-open-page">
    <!-- 支付链接复制区域 -->
    <view class="pay-link-section">
      <view class="section-title">捐赠&支持</view>
      <view class="link-card">
        <text class="link-desc">请点击以下按钮，复制链接在任意浏览器中打开:</text>
        <!-- 支付链接复制按钮 - 自定义样式 -->
        <view class="pay-link-wrapper">
          <view
            class="tooltip-container pay-tooltip"
            @click="copyPayLink"
          >
            <text class="tooltip">https://youupro.xyz/pay/</text>
            <text class="text">一键复制</text>
            <text>复制成功!</text>
          </view>
        </view>

        <!-- 邮箱复制区域 - 自定义样式 -->
        <view class="email-desc">出现任何疑问请发送邮件至: skixkk7@163.com</view>
        <view class="email-wrapper">
          <view
            class="tooltip-container email-tooltip"
            @click="copyEmail"
          >
            <text class="text">复制邮箱</text>
            <text class="tooltip">skixkk7@163.com</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 加载中遮罩 -->
    <view
      v-if="isLoading"
      class="loading-mask"
    >
      <uni-load-more
        type="loading"
        text="处理中..."
      ></uni-load-more>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

// ========== 业务逻辑 ==========
// 加载状态
const isLoading = ref<boolean>(false)

// 复制支付链接函数
const copyPayLink = (): void => {
  // 获取支付链接文本
  const payLink = 'https://youupro.xyz/pay/'
  // uni-app复制到剪贴板API
  uni.setClipboardData({
    data: payLink,
    success: () => {
      uni.showToast({
        title: '链接复制成功',
        icon: 'success',
        duration: 2000,
      })
    },
    fail: () => {
      uni.showToast({
        title: '复制失败，请手动复制',
        icon: 'none',
        duration: 2000,
      })
    },
  })
}

// 复制邮箱函数
const copyEmail = (): void => {
  // 获取邮箱文本
  const email = 'skixkk7@163.com'
  // uni-app复制到剪贴板API
  uni.setClipboardData({
    data: email,
    success: () => {
      uni.showToast({
        title: '邮箱复制成功',
        icon: 'success',
        duration: 2000,
      })
    },
    fail: () => {
      uni.showToast({
        title: '复制失败，请手动复制',
        icon: 'none',
        duration: 2000,
      })
    },
  })
}

// 统一登录态校验函数（匹配你的存储Key）
const checkLoginState = (): { isLogin: boolean; openId: string } => {
  // 读取本地存储的登录凭证
  const accessToken = uni.getStorageSync('accessToken')
  const userOpenId = uni.getStorageSync('userOpenId')

  // 校验规则: 必须同时存在accessToken和userOpenId才视为已登录
  const isLogin = !!accessToken && !!userOpenId && typeof userOpenId === 'string'
  return {
    isLogin,
    openId: isLogin ? userOpenId : '',
  }
}

// 页面显示时校验登录态
onShow(() => {
  const { isLogin } = checkLoginState()
  if (!isLogin) {
    uni.showToast({ title: '请微信登录', icon: 'none' })
    // 延迟跳转，避免弹窗被覆盖
    setTimeout(() => {
      uni.navigateTo({ url: '/pagesMember/login/login' })
    }, 1500)
  }
})
</script>

<style scoped lang="scss">
$primary-color: #ff7d00;
$text-primary: #333;
$text-secondary: #666;
$white: #ffffff;
$gray-light: #f9f9f9;
$shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
$radius-lg: 20rpx;
$radius-md: 12rpx;

.vip-open-page {
  background-color: $gray-light;
  min-height: 100vh;
  padding: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 20rpx;
  padding-left: 8rpx;
  border-left: 4rpx solid $primary-color;
}

// 支付链接区域样式
.pay-link-section {
  background-color: $white;
  border-radius: $radius-lg;
  padding: 28rpx 24rpx;
  margin-bottom: 40rpx;
  box-shadow: $shadow;
}

.link-card {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.link-desc {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.5;
}

.email-desc {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.5;
  margin-top: 20rpx;
}

.pay-link-wrapper {
  margin: 10rpx 0;
}

.email-wrapper {
  margin: 10rpx 0;
}

// ========== 基础 tooltip-container 样式定义（补全核心） ==========
.tooltip-container {
  box-sizing: border-box;
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

// ========== 支付链接复制按钮样式 (基于基础tooltip-container扩展) ==========
.pay-tooltip {
  --background: #ff4500;
  --color: #e62020;
  position: relative;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color);
  padding: 0 36rpx;
  border-radius: 8rpx;
  text-transform: uppercase;
  height: 60rpx;
  width: 280rpx; // 适配移动端加宽
  display: grid;
  place-items: center;
  border: 2px solid var(--color);
}

.pay-tooltip .text {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  transform-origin: -100%;
  transform: scale(1);
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.pay-tooltip text:last-child {
  position: absolute;
  top: 0%;
  left: 100%;
  width: 100%;
  height: 100%;
  border-radius: 8rpx;
  opacity: 1;
  background-color: var(--background);
  z-index: -1;
  border: 2px solid var(--background);
  transform: scale(0);
  transform-origin: 0;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  display: grid;
  place-items: center;
}

.pay-tooltip .tooltip {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  padding: 6rpx 12rpx;
  opacity: 0;
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  background: var(--background);
  z-index: 99;
  border-radius: 8rpx;
  scale: 0;
  transform-origin: 0 0;
  text-transform: capitalize;
  font-weight: 400;
  font-size: 24rpx;
  box-shadow: rgba(0, 0, 0, 0.25) 0 8rpx 15rpx;
}

.pay-tooltip .tooltip::before {
  position: absolute;
  content: '';
  height: 12rpx;
  width: 12rpx;
  bottom: -4rpx;
  left: 50%;
  transform: translate(-50%) rotate(45deg);
  background: var(--background);
}

.pay-tooltip:hover .tooltip {
  top: -100%;
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  scale: 1;
  animation: shake 0.5s ease-in-out both;
}

.pay-tooltip:hover {
  box-shadow: rgba(0, 0, 0, 0.25) 0 8rpx 15rpx;
  color: white;
  border-color: transparent;
}

.pay-tooltip:hover text:last-child {
  transform: scale(1);
  left: 0;
}

.pay-tooltip:hover .text {
  opacity: 0;
  top: 0%;
  left: 100%;
  transform: scale(0);
}

// ========== 邮箱复制按钮样式 (基于基础tooltip-container扩展) ==========
.email-tooltip {
  position: relative;
  display: inline-block;
  margin: 20rpx 0;
}

.email-tooltip .text {
  color: #000000;
  font-size: 28rpx;
  cursor: pointer;
  padding: 10rpx 20rpx;
  background-color: #e0e7ff;
  border-radius: 8rpx;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  border: 1px solid #e0e0e0;
}

.email-tooltip .tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  visibility: hidden;
  background: #ff4500;
  color: #fff;
  padding: 20rpx;
  border-radius: 4rpx;
  transition:
    opacity 0.3s,
    visibility 0.3s,
    top 0.3s,
    background 0.3s;
  z-index: 99;
  box-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.2);
  font-size: 24rpx;
  white-space: nowrap;
}

.email-tooltip .tooltip::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  border-width: 16rpx;
  border-style: solid;
  border-color: transparent transparent #ff44008a transparent;
  transform: translateX(-50%);
}

.email-tooltip:hover .tooltip {
  top: 120%;
  opacity: 1;
  visibility: visible;
  background: #ff44008a;
  transform: translate(-50%, -10rpx);
}

// ========== 动画定义 ==========
@keyframes shake {
  0% {
    rotate: 0;
  }

  25% {
    rotate: 7deg;
  }

  50% {
    rotate: -7deg;
  }

  75% {
    rotate: 1deg;
  }

  100% {
    rotate: 0;
  }
}

// 加载遮罩样式
.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}
</style>
