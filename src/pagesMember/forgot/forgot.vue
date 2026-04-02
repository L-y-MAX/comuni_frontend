<template>
  <view class="container">
    <!-- 顶部返回按钮 -->
    <view
      class="back-btn"
      @click="navigateBack"
    >
      <uni-icons
        type="left"
        size="24"
        color="#666"
      />
    </view>

    <!-- 标题区域 -->
    <view class="title-area">
      <text class="title">忘记密码</text>
      <text class="subtitle">找回密码请按照以下指引操作</text>
    </view>

    <!-- 替换原有表单，改为找回密码指引 -->
    <view class="guide-container">
      <view class="guide-item">
        <text class="guide-title">账号登录 - 忘记密码</text>
        <text class="guide-desc">
          请发送邮件至下方邮箱，邮件中注明您的注册邮箱（一个邮箱仅绑定一个账户），我们的团队将协助您重置密码；
          未注明注册邮箱时，将以您发送邮件的邮箱作为验证依据。
        </text>
      </view>

      <view class="guide-item">
        <text class="guide-title">微信登录 - 无需找回密码</text>
        <text class="guide-desc">
          微信登录无需重置密码，直接点击「微信一键登录」即可；如有任何问题，请发送邮件至下方邮箱。
        </text>
      </view>

      <!-- 复制邮箱按钮 -->
      <button
        class="copy-email-btn"
        @click="copyContactEmail"
      >
        复制联系邮箱
      </button>
    </view>

    <!-- 底部跳转登录 -->
    <view class="link-area">
      <text>记得密码了？</text>
      <text
        class="link"
        @click="navigateToLogin"
      >
        立即登录
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
// 保留核心导航逻辑，移除表单相关代码
const navigateBack = () => {
  uni.navigateBack()
}

// 跳转到登录页
const navigateToLogin = () => {
  uni.navigateTo({ url: '/pagesMember/login/login' })
}

/**
 * 复制联系邮箱到用户剪贴板
 */
const copyContactEmail = () => {
  const contactEmail = 'skixkk7@163.com'
  uni.setClipboardData({
    data: contactEmail,
    success: () => {
      uni.showToast({
        title: '邮箱: skixkk7@163.com',
        icon: 'none',
        duration: 4000,
      })
    },
    fail: (err) => {
      uni.showToast({
        title: '邮箱: skixkk7@163.com',
        icon: 'none',
        duration: 4000,
      })
      console.error('复制失败, 联系我们，邮箱: skixkk7@163.com', err)
    },
  })
}
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f9fafb;
  padding: 20rpx 30rpx;
}

.back-btn {
  padding: 20rpx 0;
}

.title-area {
  margin: 60rpx 0 80rpx;
  text-align: center;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 15rpx;
}

.subtitle {
  font-size: 26rpx;
  color: #666;
}

.guide-container {
  flex: 1;
  width: 100%;
  padding: 0 10rpx;
}

.guide-item {
  margin-bottom: 40rpx;
}

.guide-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 15rpx;
}

.guide-desc {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  display: block;
}

.copy-email-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #9fa8da 0%, #7986cb 100%);
  border-radius: 50rpx;
  margin-top: 50rpx;
  border: none;
}

.link-area {
  display: flex;
  justify-content: center;
  margin: 60rpx 0;
  font-size: 26rpx;
  color: #666;
}

.link {
  color: #6b85d8;
  margin-left: 10rpx;
  text-decoration: underline;
}

.form-container,
.input-group,
.input-label,
.input-wrapper,
.input-icon,
.input,
.toggle-icon,
.code-btn,
.error-text,
.submit-btn {
  display: none;
}
</style>
