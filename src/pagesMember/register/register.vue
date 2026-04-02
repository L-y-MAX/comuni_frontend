<template>
  <view class="register-container">
    <view class="register-card">
      <text class="title">账号注册</text>

      <!-- 替换原有表单，改为注册引导提示 -->
      <view class="tips-group">
        <text class="tips-main">点击「微信登录」即可完成注册</text>
        <text class="tips-sub">
          若需账号密码登录，请点击右下方「联系我们」复制邮箱并发送邮件；
          未提供联系方式时，将以您发送邮件的邮箱作为回复邮箱，将注册信息发送至邮箱。
        </text>
      </view>

      <!-- 引导到登录页（微信登录） -->
      <button
        class="register-btn"
        @click="gotoLoginPage"
      >
        前往微信登录
      </button>

      <view class="link-group">
        <navigator
          url="/pagesMember/login/login"
          class="login-link"
        >
          已有账号？去登录
        </navigator>
        <!-- 修改：将navigator改为view，绑定复制邮箱点击事件 -->
        <view
          class="forgot-link"
          @click="copyContactEmail"
        >
          联系我们
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 仅保留跳转登录页逻辑，新增复制邮箱函数
const gotoLoginPage = () => {
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

<style scoped lang="scss">
.register-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50rpx 30rpx;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #eef1f5 100%);
}

.register-card {
  width: 100%;
  max-width: 500rpx;
  background-color: #fff;
  border-radius: 20rpx;
  padding: 60rpx 40rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.05);
}

.title {
  display: block;
  text-align: center;
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 50rpx;
  color: #6b7280;
}

// 新增提示文字样式
.tips-group {
  margin-bottom: 40rpx;

  .tips-main {
    display: block;
    font-size: 28rpx;
    color: #333;
    line-height: 1.6;
    margin-bottom: 20rpx;
  }

  .tips-sub {
    display: block;
    font-size: 24rpx;
    color: #6b7280;
    line-height: 1.6;
  }
}

// 保留原有按钮样式，仅修改文案
.register-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 30rpx;
  border-radius: 40rpx;
  background: linear-gradient(90deg, #8ea1e1 0%, #7b93d4 100%);
  color: #fff;
  margin-bottom: 30rpx;
}

.link-group {
  display: flex;
  justify-content: space-between;
  padding: 0 20rpx;

  .login-link,
  .forgot-link {
    font-size: 26rpx;
    color: #8ea1e1;
    text-decoration: none;
  }
}
</style>
