<template>
  <view class="my-page">
    <!-- 顶部背景区域 -->
    <view class="top-section">
      <view class="background-pattern">
        <view class="bg-circle bg-circle-1"></view>
        <view class="bg-circle bg-circle-2"></view>
        <view class="bg-circle bg-circle-3"></view>
      </view>

      <!-- 用户信息卡片 -->
      <view class="user-card">
        <!-- 头像信息区域 - 绑定点击跳转 -->
        <view
          class="user-avatar-section"
          @click="handleUserCardClick"
        >
          <view class="avatar-wrapper">
            <!-- 头像显示逻辑：有头像显示图片，无则显示文字头像 -->
            <image
              v-if="userAvatar && userAvatar !== ''"
              class="user-avatar"
              :src="userAvatar"
              mode="aspectFill"
            ></image>
            <view
              v-else
              class="avatar-text"
              :style="{ backgroundColor: getAvatarColor() }"
            >
              <text>{{ getAvatarText() }}</text>
            </view>
            <view class="avatar-glow"></view>
          </view>
          <view class="user-basic-info">
            <text class="user-name">{{ userName }}</text>
            <text class="user-role">{{ userDesc }}</text>
          </view>
        </view>

        <!-- 会员状态 - 绑定点击跳转 -->
        <view
          class="membership-status"
          @click="handleVipFeature"
        >
          <view
            v-if="isVip"
            class="vip-status-card"
          >
            <view class="vip-details">
              <!-- 尊贵会员时显示VIP图标 -->
              <view class="vip-label-wrap">
                <image
                  v-if="isVip"
                  class="vip-icon"
                  src="https://youupro.xyz/notes/static/icons/vip.png"
                  mode="aspectFit"
                />
                <text class="vip-label">尊贵会员</text>
              </view>
              <text class="vip-expiry">到期: {{ vipExpireDate }}</text>
            </view>
          </view>
          <view
            v-else
            class="normal-status-card"
          >
            <view class="normal-details">
              <text class="normal-label">普通用户</text>
              <text class="normal-upgrade">升级解锁更多功能</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 设置表单区域 - 悬浮效果调整 -->
    <view class="forms-section">
      <view class="form-card">
        <!-- 岗位能力画像（核心功能，放在最前） -->
        <view
          class="form-item"
          :class="{ active: activeItemId === 'jobProfile' }"
          @click="navigateToJobProfile"
          @touchstart="() => setActiveItem('jobProfile')"
          @touchend="() => clearActiveItem()"
        >
          <view class="form-label">
            <text class="label-text">岗位能力画像</text>
          </view>
          <view class="form-control">
            <image
              class="forward-icon"
              src="https://youupro.xyz/notes/static/icons/forward.png"
              mode="aspectFit"
            />
          </view>
        </view>
        <!-- 知识库（能力画像已上移到 tabBar，此处改为知识库入口） -->
        <view
          class="form-item"
          :class="{ active: activeItemId === 'knowledge' }"
          @click="navigateToKnowledge"
          @touchstart="() => setActiveItem('knowledge')"
          @touchend="() => clearActiveItem()"
        >
          <view class="form-label">
            <text class="label-text">知识库</text>
          </view>
          <view class="form-control">
            <image
              class="forward-icon"
              src="https://youupro.xyz/notes/static/icons/forward.png"
              mode="aspectFit"
            />
          </view>
        </view>
        <!-- 原有表单项保留，调整会员权益和岗位招聘位置 -->
        <view
          class="form-item"
          :class="{ active: activeItemId === 'follow' }"
          @click="navigateToFollowPage"
          @touchstart="() => setActiveItem('follow')"
          @touchend="() => clearActiveItem()"
        >
          <view class="form-label">
            <text class="label-text">我的关注/粉丝</text>
          </view>
          <view class="form-control">
            <image
              class="forward-icon"
              src="https://youupro.xyz/notes/static/icons/forward.png"
              mode="aspectFit"
            />
          </view>
        </view>
        <!-- 岗位招聘入口已移到首页，此处不再保留 -->
        <!-- 功能说明（替换原会员权益） -->
        <view
          class="form-item"
          :class="{ active: activeItemId === 'instruction' }"
          @click="openInstructionManual"
          @touchstart="() => setActiveItem('instruction')"
          @touchend="() => clearActiveItem()"
        >
          <view class="form-label">
            <text class="label-text">功能说明</text>
          </view>
          <view class="form-control">
            <image
              class="forward-icon"
              src="https://youupro.xyz/notes/static/icons/forward.png"
              mode="aspectFit"
            />
          </view>
        </view>
        <!-- 联系我们  -->
        <view
          class="form-item"
          :class="{ active: activeItemId === 'contact' }"
          @click="copyContactEmail"
          @touchstart="() => setActiveItem('contact')"
          @touchend="() => clearActiveItem()"
        >
          <view class="form-label">
            <text class="label-text">联系我们</text>
          </view>
          <view class="form-control">
            <image
              class="forward-icon"
              src="https://youupro.xyz/notes/static/icons/forward.png"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>
    </view>

    <!-- 会员升级推广：修改显示条件 - 仅登录且非VIP时显示 -->
    <view
      v-if="isLogged && !isVip"
      class="upgrade-section"
    >
      <view class="upgrade-card">
        <view class="upgrade-content">
          <view class="upgrade-icon">🚀</view>
          <view class="upgrade-text">
            <text class="upgrade-title">升级到会员</text>
            <text class="upgrade-subtitle">解锁尊贵会员</text>
          </view>
          <view
            class="upgrade-button"
            @click="handleOpenVip"
          >
            <text class="upgrade-btn-text">立即升级</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 登录/退出登录区域（核心修改） -->
    <view
      v-if="isLogged"
      class="logout-section"
    >
      <view
        class="logout-button"
        @click="logout"
      >
        <text class="logout-text">退出登录</text>
      </view>
    </view>
    <!-- 未登录：显示拆分的登录按钮 -->
    <view
      v-else
      class="login-section"
    >
      <view class="split-login-button">
        <!-- 左侧2/3：微信一键登录 -->
        <view
          class="wechat-login-part"
          @click="wxQuickLogin"
        >
          <image
            src="https://youupro.xyz/notes/static/icons/wx.png"
            class="wechat-icon-small"
            mode="widthFix"
          />
          <text class="wechat-login-text">微信一键登录</text>
        </view>
        <!-- 分隔线 -->
        <view class="split-line"></view>
        <!-- 右侧1/3：跳转账号密码登录 -->
        <view
          class="account-login-part"
          @click="navigateToLoginPage"
        >
          <text class="account-login-text">账号登录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import {
  onLoad,
  onShow,
  onPullDownRefresh,
  onShareAppMessage,
  onShareTimeline,
} from '@dcloudio/uni-app'

import {
  handleUserCardClick,
  getUserInfo,
  userAvatar,
  userName,
  isVip,
  isLogged,
  userDesc,
  vipExpireDate,
  handleVipFeature,
  handleOpenVip,
  checkVipStatus,
  fetchVipInfoFromServer,
  logout,
  getAvatarColor,
  getAvatarText,
  navigateToFollowPage,
  setActiveItem,
  clearActiveItem,
  activeItemId,
  copyContactEmail,
  wxQuickLogin,
  navigateToLoginPage,
  navigateToAbilityProfile, // 能力画像（tabBar 页，内部用 switchTab）
  navigateToKnowledge, // 知识库（已从 tabBar 移出，改从「我的」进入）
  navigateToJobProfile, // 岗位能力画像（缺参数时会进入岗位选择模式）
} from './my'

// 修改：打开功能说明手册的函数 - 直接跳转分包页面，移除接口请求逻辑
const openInstructionManual = () => {
  // 直接跳转到功能说明页面（路径为实际的分包页面路径）
  uni.navigateTo({
    url: '/pagesMember/instruction/instruction',
    fail: (err) => {
      uni.showToast({
        title: '跳转失败，请重试',
        icon: 'none',
        duration: 2000,
      })
      console.error('跳转功能说明页面失败：', err)
    },
  })
}

// ========== 页面生命周期 ==========
// 页面加载时执行（首次进入）
onLoad(() => {
  console.log('我的页面加载完成')
  // 延迟执行，确保 Pinia 完全初始化
  setTimeout(() => getUserInfo(), 0.5)
  // 每次初始化页面时，先从服务器更新会员信息，再检查状态
  fetchVipInfoFromServer().then(() => {
    checkVipStatus()
  })
})

// 新增：页面每次显示时执行（从其他页面返回/下拉刷新后）
onShow(() => {
  getUserInfo() // 刷新用户信息
  checkVipStatus() // 同步刷新会员状态（可选，保持数据一致）
})

// 新增：下拉刷新时执行
onPullDownRefresh(() => {
  // 先刷新用户信息，再刷新会员信息，最后停止下拉刷新动画
  fetchVipInfoFromServer()
    .then(() => {
      checkVipStatus()
      getUserInfo()

      // 停止下拉刷新动画（必须调用，否则刷新图标会一直转）
      uni.stopPullDownRefresh()
    })
    .catch(() => {
      // 失败也停止刷新动画
      uni.stopPullDownRefresh()
      uni.showToast({
        title: '刷新失败，请重试',
        icon: 'none',
        duration: 2000,
      })
    })
})

// ========== 新增：微信小程序分享功能 ==========
// 分享给好友（胶囊按钮三点菜单触发）
onShareAppMessage(() => {
  return {
    title: `${userName.value}的个人中心 - Comuni知识平台`, // 动态显示用户名
    path: '/pages/my/my', // 分享后打开的页面路径
    imageUrl: 'https://youupro.xyz/notes/static/logo.png', // 分享卡片图片（可选）
    desc: '快来查看我的个人中心，一起探索知识平台吧！', // 分享描述（可选）
  }
})

// 分享到朋友圈（胶囊按钮三点菜单触发）
onShareTimeline(() => {
  return {
    title: `${userName.value}的个人中心 - Comuni知识平台`, // 朋友圈分享标题
    path: '/pages/my/my', // 分享后打开的页面路径
    imageUrl: 'https://youupro.xyz/notes/static/logo.png', // 朋友圈分享图片（可选）
  }
})
</script>

<style scoped lang="scss">
// Modern Light Blue Theme Design - 写实风调整
$primary-color: #3b82f6; // 淡蓝色主色
$secondary-color: #60a5fa; // 浅淡蓝色
$accent-color: #93c5fd; // 更浅的蓝色
$success-color: #10b981; // 绿色保持
$text-primary: #1f2937; // 深黑
$text-secondary: #6b7280; // 中灰
$text-tertiary: #9ca3af; // 浅灰
$white: #ffffff; // 白
$gray-light: #f8fafc; // 极浅蓝色背景
$gray-lighter: #f1f5f9; // 浅蓝色
$shadow-light: 0 2rpx 12rpx rgba(59, 130, 246, 0.08);
$shadow-medium: 0 4rpx 24rpx rgba(59, 130, 246, 0.12);
$shadow-strong: 0 8rpx 32rpx rgba(59, 130, 246, 0.16);
$shadow-float: 0 8rpx 24rpx rgba(0, 0, 0, 0.08); // 悬浮阴影
$shadow-form-float: 0 12rpx 32rpx rgba(0, 0, 0, 0.06); // 表单卡片悬浮阴影
$border-radius-large: 24rpx;
$border-radius-medium: 20rpx;
$border-radius-small: 16rpx;

.my-page {
  min-height: 100vh;
  background: $gray-light;
  padding-bottom: 120rpx;
}

// 顶部区域设计 - 写实风渐变背景
.top-section {
  position: relative;
  background: linear-gradient(135deg, #e0e7ff 0%, #d1fec7 100%);
  padding: 60rpx 24rpx 120rpx;
  border-radius: 0 0 $border-radius-large $border-radius-large;
  margin-bottom: 4rpx;
  overflow: hidden;
}

// 用户信息卡片 - 悬浮效果
.user-card {
  position: relative;
  z-index: 2;
  width: 100%;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
}

// 头像信息区域 - 悬浮卡片
.user-avatar-section {
  display: flex;
  align-items: center;
  background: $white;
  backdrop-filter: blur(20rpx);
  border-radius: $border-radius-large;
  padding: 32rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.8);
  box-shadow: $shadow-float;
  margin-bottom: -20rpx; // 与下方会员卡片重叠，实现挂起效果
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  position: relative;
  z-index: 3;
  cursor: pointer;
  transition: all 0.2s ease;

  &:active {
    transform: translateY(2rpx);
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  }
}

.avatar-wrapper {
  position: relative;
  margin-right: 24rpx;
}

.user-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid $white;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

// 文字头像样式（和user-detail保持一致）
.avatar-text {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid $white;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);

  text {
    color: #fff;
    font-size: 40rpx;
    font-weight: 600;
  }
}

.user-basic-info {
  flex: 1;
}

.user-name {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: 8rpx;
  text-shadow: none;
}

.user-role {
  display: block;
  font-size: 28rpx;
  color: $text-secondary;
  font-weight: 500;
}

// 会员状态 - 挂起效果
.membership-status {
  margin: 0 20rpx;
  position: relative;
  z-index: 2;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效

  &:active {
    transform: translateY(2rpx);
  }
}

.vip-status-card,
.normal-status-card {
  display: flex;
  align-items: center;
  background: $white;
  border-radius: $border-radius-medium;
  padding: 24rpx 32rpx;
  backdrop-filter: blur(10rpx);
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

// VIP图标样式
.vip-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
}

.vip-label-wrap {
  display: flex;
  align-items: center;
}

.vip-details,
.normal-details {
  flex: 1;
}

.vip-label,
.normal-label {
  display: inline-block;
  font-size: 30rpx;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.vip-expiry,
.normal-upgrade {
  display: block;
  font-size: 24rpx;
  color: $text-secondary;
  font-weight: 400;
}

// ========== 调整表单区域悬浮样式 ==========
// 设置表单区域 - 悬浮在上方
.forms-section {
  padding: 0 24rpx;
  margin: -60rpx 0 32rpx 0; // 向上偏移实现悬浮效果，覆盖顶部区域下方
  position: relative;
  z-index: 4; // 提高层级确保浮在最上层
}

// 表单卡片 - 强化悬浮视觉
.form-card {
  background: $white;
  border-radius: $border-radius-medium;
  box-shadow: $shadow-form-float; // 更强的悬浮阴影
  overflow: hidden;
  border: 1rpx solid rgba(255, 255, 255, 0.95); // 白色边框增强悬浮感
}

.form-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 24rpx;
  border-bottom: 1rpx solid $gray-lighter;
  transition: background-color 0.3s ease;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  position: relative; // 为伪元素定位提供参考

  // 左右滑动的渐变遮罩层
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%; // 初始在左侧外部
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(167, 139, 250, 0.08) 50%,
      transparent 100%
    );
    transition: left 0.5s ease; // 控制滑动动画时长和缓动效果
    pointer-events: none; // 避免遮罩层影响点击事件
  }

  // 替换:active为.active类，实现单个item独立控制
  &.active {
    background-color: rgba(167, 139, 250, 0.08); // 淡紫色点击背景色
    transform: translateY(2rpx);
    box-shadow: $shadow-medium;

    // 点击时遮罩层从左滑到右
    &::before {
      left: 100%;
    }
  }

  &:last-child {
    border-bottom: none;
  }
}

.form-label {
  display: flex;
  align-items: center;
}

.label-text {
  font-size: 32rpx;
  font-weight: 500;
  color: $text-primary;
}

.form-control {
  display: flex;
  align-items: center;
}

.forward-icon {
  width: 24rpx;
  height: 24rpx;
  opacity: 0.6;
}

.menu-card {
  background: $white;
  border-radius: $border-radius-large;
  padding: 32rpx 24rpx;
  box-shadow: $shadow-light;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1rpx solid rgba(59, 130, 246, 0.1);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4rpx;
    background: linear-gradient(90deg, $primary-color 0%, $secondary-color 100%);
    transform: scaleX(0);
    transition: transform 0.3s ease;
  }

  &:active {
    transform: translateY(4rpx);
    box-shadow: $shadow-medium;

    &::before {
      transform: scaleX(1);
    }
  }
}

.vip-menu-card {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(96, 165, 250, 0.05) 100%);
  border-color: rgba(59, 130, 246, 0.2);

  &::before {
    background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%);
  }
}

.menu-card-icon {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(96, 165, 250, 0.1) 100%);
  border-radius: $border-radius-medium;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  box-shadow: $shadow-light;
  transition: transform 0.3s ease;
}

.menu-card:active .menu-card-icon {
  transform: scale(1.1);
}

.menu-icon-text {
  font-size: 32rpx;
}

.menu-card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 6rpx;
}

.menu-card-desc {
  display: block;
  font-size: 24rpx;
  color: $text-secondary;
  font-weight: 400;
}

// 升级区域
.upgrade-section {
  padding: 0 24rpx;
  margin-bottom: 24rpx;
}

.upgrade-card {
  background: $white;
  border-radius: $border-radius-large;
  padding: 32rpx 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(59, 130, 246, 0.25);
  position: relative;
  overflow: hidden;
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.upgrade-content {
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
}

.upgrade-icon {
  font-size: 48rpx;
  margin-right: 20rpx;
}

.upgrade-text {
  flex: 1;
}

.upgrade-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: 6rpx;
  text-shadow: none;
}

.upgrade-subtitle {
  display: block;
  font-size: 26rpx;
  color: $text-secondary;
  font-weight: 500;
}

.upgrade-button {
  background: $primary-color;
  border-radius: $border-radius-medium;
  padding: 16rpx 24rpx;
  backdrop-filter: blur(10rpx);
  border: 1rpx solid $primary-color;
  transition: all 0.3s ease;

  &:active {
    background: $secondary-color;
    transform: scale(0.95);
  }
}

.upgrade-btn-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $white;
  text-shadow: none;
}

// 退出登录区域
.logout-section {
  padding: 0 24rpx;
}

// 退出登录按钮 - 包含左右滑动的渐变动画效果
.logout-button {
  background: $white;
  border-radius: $border-radius-large;
  padding: 32rpx 24rpx;
  box-shadow: $shadow-light;
  border: 1rpx solid rgba(239, 68, 68, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  // 左右滑动的渐变遮罩层
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%; // 初始在左侧外部
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(239, 68, 68, 0.1) 50%,
      transparent 100%
    );
    transition: left 0.5s ease; // 控制滑动动画时长和缓动效果
  }

  &:active {
    transform: translateY(2rpx);
    box-shadow: $shadow-medium;

    // 点击时遮罩层从左滑到右
    &::before {
      left: 100%;
    }
  }
}

.logout-text {
  display: block;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #ef4444;
  text-shadow: 0 1rpx 2rpx rgba(239, 68, 68, 0.1);
}

// ========== 新增：拆分登录按钮样式 ==========
.login-section {
  padding: 0 24rpx;
  margin-bottom: 24rpx;
}

.split-login-button {
  display: flex;
  width: 100%;
  height: 88rpx;
  background: $white;
  border-radius: $border-radius-large;
  box-shadow: $shadow-medium;
  overflow: hidden;
  border: 1rpx solid rgba(59, 130, 246, 0.1);
}

// 左侧微信登录部分（2/3宽度）
.wechat-login-part {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  background: #07c160;
  transition: all 0.3s ease;

  &:active {
    background: #06b058;
    transform: scale(0.98);
  }
}

.wechat-icon-small {
  width: 32rpx;
  height: 32rpx;
}

.wechat-login-text {
  font-size: 30rpx;
  font-weight: 600;
  color: $white;
}

// 分隔线
.split-line {
  width: 1rpx;
  background: rgba(255, 255, 255, 0.5);
  height: 60%;
  align-self: center;
}

// 右侧账号登录部分（1/3宽度）
.account-login-part {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3b82f6;
  transition: all 0.3s ease;

  &:active {
    background: #2563eb;
    transform: scale(0.98);
  }
}

.account-login-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $white;
}

// 响应式设计
@media (max-width: 750rpx) {
  .menu-grid {
    grid-template-columns: 1fr;
    gap: 16rpx;
  }

  .user-avatar,
  .avatar-text {
    width: 100rpx;
    height: 100rpx;
  }

  .avatar-text text {
    font-size: 36rpx;
  }

  .user-name {
    font-size: 32rpx;
  }

  .menu-card {
    padding: 24rpx 20rpx;
  }

  // 响应式适配拆分登录按钮
  .wechat-login-text {
    font-size: 26rpx;
  }

  .account-login-text {
    font-size: 24rpx;
  }

  // 响应式调整表单悬浮偏移
  .forms-section {
    margin: -40rpx 0 32rpx 0;
  }
}
</style>
