<template>
  <view class="vip-info-page">
    <!-- 会员权益主内容 -->
    <scroll-view
      class="content-scroll"
      scroll-y
    >
      <!-- 会员头部横幅 -->
      <view class="vip-banner">
        <view class="banner-content">
          <text class="banner-title">尊贵会员专属权益</text>
          <text class="banner-subtitle">解锁更多职业发展特权</text>
        </view>
      </view>

      <!-- 权益列表 -->
      <view class="benefits-list">
        <!-- 权益1：一对一就业指导 -->
        <view class="benefit-item">
          <view class="benefit-icon">专属指导</view>
          <view class="benefit-content">
            <text class="benefit-title">私人专享：一对一就业指导</text>
            <text class="benefit-desc">
              资深职业顾问1v1定制就业方案，解答求职困惑，提升求职成功率
            </text>
          </view>
        </view>

        <!-- 功能提示 -->
        <view class="benefit-item">
          <view class="benefit-icon">温馨提示</view>
          <view class="benefit-content">
            <text class="benefit-title">功能说明</text>
            <text class="benefit-desc">当前功能包括了尊贵会员的全部功能，其他功能敬请期待</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

// 页面加载
onLoad(() => {
  console.log('会员权益页面加载完成')
})
</script>

<style scoped lang="scss">
// 主题变量
$primary-color: #ff4500; // 橙红色主题色
$secondary-color: #ff6347;
$text-primary: #1f2937;
$text-secondary: #6b7280;
$bg-light: #f8fafc;
$white: #ffffff;
$border-radius: 16rpx;
$border-radius-large: 24rpx;
$shadow-light: 0 4rpx 24rpx rgba(255, 69, 0, 0.08);

// 页面基础样式
.vip-info-page {
  min-height: 100vh;
  background-color: $bg-light;
}

// 滚动内容区域
.content-scroll {
  min-height: 100vh;
  padding-bottom: 40rpx;
}

// 会员横幅
.vip-banner {
  background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
  padding: 60rpx 24rpx;
  text-align: center;

  .banner-content {
    .banner-title {
      display: block;
      font-size: 36rpx;
      font-weight: 700;
      color: $white;
      margin-bottom: 16rpx;
    }

    .banner-subtitle {
      display: block;
      font-size: 28rpx;
      color: rgba(255, 255, 255, 0.9);
    }
  }
}

// 权益列表
.benefits-list {
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

// 单个权益项
.benefit-item {
  background-color: $white;
  border-radius: $border-radius-large;
  padding: 32rpx;
  box-shadow: $shadow-light;
  display: flex;
  align-items: flex-start;
  gap: 24rpx;

  .benefit-icon {
    font-size: 28rpx;
    color: $primary-color;
    font-weight: 600;
    background-color: rgba(255, 69, 0, 0.1);
    padding: 12rpx 16rpx;
    border-radius: 8rpx;
    margin-top: 4rpx;
  }

  .benefit-content {
    flex: 1;

    .benefit-title {
      display: block;
      font-size: 32rpx;
      font-weight: 600;
      color: $text-primary;
      margin-bottom: 12rpx;
    }

    .benefit-desc {
      display: block;
      font-size: 26rpx;
      color: $text-secondary;
      line-height: 1.6;
    }
  }
}

// 响应式适配
@media (max-width: 750rpx) {
  .benefit-item {
    padding: 24rpx;
    gap: 16rpx;

    .benefit-icon {
      font-size: 24rpx;
      padding: 8rpx 12rpx;
    }

    .benefit-title {
      font-size: 28rpx;
    }

    .benefit-desc {
      font-size: 24rpx;
    }
  }
}
</style>
