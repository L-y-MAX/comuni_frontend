<template>
  <view
    class="search-page"
    :class="{ searching: isSearching }"
  >
    <!-- 品牌sign+文字 -->
    <view class="brand-sign">
      <view class="brand-sign-internal"></view>
    </view>
    <view class="brand-text">
      <image
        src="https://youupro.xyz/notes/static/logo.png"
        class="brand-logo-img"
        mode="widthFix"
      ></image>
    </view>

    <!-- 搜索框容器 -->
    <view class="search-input-wrapper">
      <input
        v-model="searchKeyword"
        class="search-input"
        type="text"
        placeholder="Search with Comuni"
        @confirm="handleSearch"
        @focus="handleInputFocus"
        @blur="handleInputBlur"
      />
      <view
        class="search-trigger"
        @tap="handleSearch"
        :class="{ loading: isLoading }"
      >
        <text
          v-if="!isLoading"
          class="icon"
        >
          ◯
        </text>
        <text
          v-else
          class="loading-icon"
        >
          ◯
        </text>
      </view>
    </view>

    <!-- 退出搜索：一键回到首页初始状态 -->
    <view
      v-if="isSearching"
      class="exit-search"
      @tap="exitSearch"
    >
      <text class="exit-search-text">✕ 退出搜索</text>
    </view>

    <!-- 岗位招聘入口（原在「我的」里叫「宣讲活动」，按要求移到首页；只在首页初始态显示） -->
    <view
      v-if="!isSearching && !searchResult"
      class="resource-entry"
      @tap="goRecruitmentList"
    >
      <view class="resource-entry-left">
        <text class="resource-entry-icon">🏢</text>
        <view class="resource-entry-texts">
          <text class="resource-entry-title">岗位招聘</text>
          <text class="resource-entry-desc">浏览校招合作企业的岗位与企业信息</text>
        </view>
      </view>
      <text class="resource-entry-arrow">›</text>
    </view>

    <!-- 就业政策与校招资源入口（只在首页初始态显示，进入搜索或出现结果后自动隐藏） -->
    <view
      v-if="!isSearching && !searchResult"
      class="resource-entry"
      @tap="goCareerResources"
    >
      <view class="resource-entry-left">
        <text class="resource-entry-icon">📚</text>
        <view class="resource-entry-texts">
          <text class="resource-entry-title">就业政策与校招资源</text>
          <text class="resource-entry-desc">就业政策 · 校招企业名单 · 简历与面试指导</text>
        </view>
      </view>
      <text class="resource-entry-arrow">›</text>
    </view>

    <!-- 本地检索结果：就业政策与校招资源（离线可用，不需要登录） -->
    <view
      v-if="isSearching && localResources.length"
      class="local-results"
    >
      <view class="local-head">
        <text class="local-title">就业政策与校招资源</text>
        <text class="local-count">命中 {{ localResources.length }} 条</text>
      </view>

      <view
        v-for="item in localResources"
        :key="item.id"
        class="local-card"
        @tap="goCareerResources(item)"
      >
        <view class="local-card-head">
          <text class="local-card-title">{{ item.title }}</text>
          <text
            class="local-card-kind"
            :class="item.kind"
          >
            {{ kindLabel(item.kind) }}
          </text>
        </view>
        <text class="local-card-meta">
          {{ item.source }}<text v-if="item.docNo"> · {{ item.docNo }}</text>
        </text>
        <text class="local-card-summary">{{ item.summary }}</text>
        <view class="local-tags">
          <text
            v-for="g in item.tags"
            :key="g"
            class="local-tag"
          >
            {{ g }}
          </text>
        </view>
      </view>

      <view
        class="local-more"
        @tap="goCareerResources()"
      >
        <text class="local-more-text">查看全部资源 →</text>
      </view>
    </view>

    <!-- 站内搜索需要登录；本地资源检索不需要 -->
    <view
      v-if="isSearching && needLoginForSiteSearch"
      class="site-login-tip"
    >
      <text class="site-login-text">
        站内搜索（知识库 / 文档 / 用户）需要登录；此处展示的是本地资源检索结果。
      </text>
      <view
        class="site-login-btn"
        @tap="goLogin"
      >
        <text class="site-login-btn-text">去登录</text>
      </view>
    </view>

    <!-- 搜索结果提示 -->
    <view
      v-if="searchResult"
      class="result-tip"
    >
      <text
        v-if="searchResult.code === 200"
        class="success-tip"
      >
        {{ searchResult.msg }}（共 {{ getResultCount(searchResult) }} 条结果）
      </text>
      <text
        v-else
        class="error-tip"
      >
        {{ searchResult.msg }}
      </text>

      <!-- 搜索结果列表 -->
      <view
        v-if="searchResult && searchResult.code === 200 && getResultCount(searchResult) > 0"
        class="search-results"
      >
        <!-- 知识库列表 -->
        <view
          class="result-section"
          v-if="(searchResult?.results?.knowledge_bases?.length ?? 0) > 0"
        >
          <text class="section-title">知识库</text>
          <view class="result-cards">
            <view
              class="result-card kb-card"
              v-for="kb in searchResult.results?.knowledge_bases"
              :key="kb.id"
            >
              <view class="card-header">
                <rich-text
                  class="card-title"
                  :nodes="highlightKeyword(kb.name)"
                ></rich-text>
                <button
                  class="add-btn follow-btn"
                  :class="{ followed: isFollowedKB(kb.id) }"
                  @click.stop="followKB(kb)"
                >
                  {{ isFollowedKB(kb.id) ? '已关注' : '+ 关注' }}
                </button>
              </view>
              <view class="card-content">
                <rich-text :nodes="highlightKeyword(kb.description || '无描述')"></rich-text>
              </view>
              <view class="card-footer kb-footer">
                <text class="card-author">创建者ID: {{ kb.creator || '未知' }}</text>
                <text class="card-time">更新于: {{ formatTime(kb.updated_at ?? '无') }}</text>
                <button
                  class="view-btn"
                  @click="navigateToKnowledgeBase(kb)"
                >
                  查看知识库
                </button>
              </view>
            </view>
          </view>
        </view>

        <!-- 文档/节点列表（修复重复展示知识库问题） -->
        <view
          class="result-section"
          v-if="(searchResult?.results?.nodes?.length ?? 0) > 0"
        >
          <text class="section-title">文档</text>
          <view class="result-cards">
            <view
              class="result-card"
              v-for="doc in searchResult.results?.nodes"
              :key="doc.id"
            >
              <view class="card-header">
                <rich-text
                  class="card-title"
                  :nodes="highlightKeyword(doc.name)"
                ></rich-text>
                <button
                  class="add-btn"
                  @click.stop="openKnowledgeModal(doc)"
                >
                  + 复制到我的知识库
                </button>
              </view>
              <view class="card-content">
                <!-- 截取内容前200字展示，避免过长 -->
                <rich-text
                  :nodes="
                    highlightKeyword((doc.content ?? doc.description ?? '').substring(0, 200)) +
                    ((doc.content ?? doc.description ?? '').length > 200 ? '...' : '')
                  "
                ></rich-text>
              </view>
              <view class="card-footer">
                <text class="card-author">作者: {{ doc.creator_username || '未知' }}</text>
                <text class="card-category">库: {{ doc.knowledge_base_name ?? '无' }}</text>
                <text class="card-time">更新于: {{ formatTime(doc.updated_at ?? '无') }}</text>
                <button
                  class="view-btn"
                  @click="navigateToKnowledge(doc)"
                >
                  查看详情
                </button>
              </view>
            </view>
          </view>
        </view>

        <!-- 用户列表（适配后端返回数据，显示用户列表） -->
        <view
          class="result-section"
          v-if="(searchResult?.results?.users?.length ?? 0) > 0"
        >
          <text class="section-title">用户</text>
          <view class="result-cards">
            <view
              class="result-card user-card"
              v-for="user in searchResult?.results?.users"
              :key="user.id"
            >
              <view class="card-header">
                <!-- 头像显示逻辑 - 有头像显示图片，无则显示文字 -->
                <view class="user-avatar">
                  <image
                    v-if="user.avatar && user.avatar !== ''"
                    :src="user.avatar"
                    class="avatar-img"
                    mode="aspectFill"
                  ></image>
                  <view
                    v-else
                    class="avatar-text"
                    :style="{ backgroundColor: getAvatarColor(user) }"
                  >
                    <text>{{ getAvatarText(user) }}</text>
                  </view>
                </view>
                <rich-text
                  class="card-title user-name"
                  :nodes="highlightKeyword(user.username)"
                ></rich-text>
                <button
                  class="add-btn follow-btn"
                  :class="{ followed: isFollowed(user) }"
                  @click.stop="followUser(user)"
                >
                  {{ isFollowed(user) ? '已关注' : '+ 关注' }}
                </button>
              </view>
              <view class="card-content user-content">
                <view class="user-info-item">
                  <text class="info-label">用户ID：</text>
                  <text class="info-value">{{ user.user_id }}</text>
                </view>
                <view class="user-info-item">
                  <text class="info-label">邮箱：</text>
                  <text class="info-value">{{ user.email || '未填写' }}</text>
                </view>
                <view class="user-info-item">
                  <text class="info-label">性别：</text>
                  <text
                    class="info-value"
                    :class="{ 'gender-hidden': formatGender(user.gender_text) === '隐藏' }"
                  >
                    {{ formatGender(user.gender_text) }}
                  </text>
                </view>
              </view>
              <view class="card-footer user-footer">
                <button
                  class="view-btn"
                  @click="navigateToUserDetail(user)"
                >
                  查看用户主页
                </button>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 半屏弹窗：选择/创建知识库 -->
    <view
      v-if="showKnowledgeModal"
      class="knowledge-modal-mask"
      @tap="showKnowledgeModal = false"
    >
      <view
        class="knowledge-modal-content"
        @tap.stop
      >
        <view class="modal-header">
          <text class="modal-title">选择要复制到的知识库</text>
          <button
            class="close-btn"
            @click="showKnowledgeModal = false"
          >
            ×
          </button>
        </view>

        <!-- 我的知识库列表 -->
        <view class="modal-body">
          <view
            v-if="isLoadingKB"
            class="loading-wrap"
          >
            <text class="loading-text">加载知识库列表中...</text>
          </view>
          <view
            v-else-if="myKnowledgeBases.length > 0"
            class="kb-list"
          >
            <view
              class="kb-item"
              v-for="kb in myKnowledgeBases"
              :key="kb.id"
              @click="addDocToKnowledgeBase(currentDoc!, kb.id)"
            >
              <text class="kb-name">{{ kb.name }}</text>
              <text class="kb-desc">{{ kb.description || '无描述' }}</text>
            </view>
          </view>
          <view
            v-else
            class="empty-tip"
          >
            暂无可用知识库，请创建新知识库
          </view>

          <!-- 新建知识库 -->
          <view class="new-kb-wrap">
            <text class="new-kb-title">创建新知识库</text>
            <input
              v-model="newKBName"
              class="new-kb-input"
              placeholder="请输入知识库名称"
              type="text"
            />
            <button
              class="create-kb-btn"
              :class="{ loading: isCreatingKB }"
              @click="createKnowledgeBase"
            >
              {{ isCreatingKB ? '创建中...' : '创建并添加文档' }}
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app' // 新增：导入分享生命周期函数
import {
  isSearching,
  searchKeyword,
  handleSearch,
  exitSearch,
  localResources,
  needLoginForSiteSearch,
  handleInputFocus,
  handleInputBlur,
  isLoading,
  searchResult,
  getResultCount,
  highlightKeyword,
  openKnowledgeModal,
  navigateToKnowledge,
  isFollowed,
  followUser,
  formatGender,
  navigateToUserDetail,
  showKnowledgeModal,
  currentDoc,
  myKnowledgeBases,
  isLoadingKB,
  newKBName,
  isCreatingKB,
  addDocToKnowledgeBase,
  createKnowledgeBase,
  isFollowedKB,
  followKB,
  getAvatarColor,
  getAvatarText,
  formatTime,
  getShareAppMessageParams, // 新增：导入分享给好友参数生成方法
  getShareTimelineParams, // 新增：导入分享到朋友圈参数生成方法
} from './index'

import { RESOURCE_KIND_LABEL, type ResourceKind } from '@/types/careerResource'

// 跳转到「岗位招聘」页面（招聘信息列表）
const goRecruitmentList = () => {
  uni.navigateTo({
    url: '/pagesMember/recruitment/recruitment-list',
    fail: (err) => {
      console.error('跳转岗位招聘页面失败：', err)
      uni.showToast({ title: '页面跳转失败', icon: 'none', duration: 2000 })
    },
  })
}

// 跳转到「就业政策与校招资源」页面；传 item 时定位到具体那一条
const goCareerResources = (item?: { id?: string }) => {
  const url = item?.id
    ? `/pagesMember/careerResources/careerResources?focus=${encodeURIComponent(item.id)}`
    : '/pagesMember/careerResources/careerResources'
  uni.navigateTo({
    url,
    fail: (err) => {
      console.error('跳转就业政策与校招资源页面失败：', err)
      uni.showToast({ title: '页面跳转失败', icon: 'none', duration: 2000 })
    },
  })
}

// 跳转到知识库详情（新增）
const navigateToKnowledgeBase = (kb: any) => {
  if (!kb.id) return
  uni.navigateTo({
    url: `/pagesMember/knowledge/baseDetail/baseDetail?id=${encodeURIComponent(kb.id as string)}`,
  })
}

// 跳转到登录页（站内搜索需要登录时使用）
const goLogin = () => {
  uni.navigateTo({ url: '/pagesMember/login/login' })
}

// 资源来源角标文案：官方文件 / 官方平台 / 媒体报道 / 平台整理
const kindLabel = (kind: ResourceKind): string => RESOURCE_KIND_LABEL[kind] ?? ''

// 新增：分享给好友（微信小程序胶囊按钮分享触发）
onShareAppMessage(() => {
  // 分享当前搜索关键词（若有），无则使用默认配置
  return getShareAppMessageParams({
    type: 'search',
    data: searchKeyword.value,
  })
})

// 新增：分享到朋友圈（微信小程序胶囊按钮分享触发）
onShareTimeline(() => {
  // 分享当前搜索关键词（若有），无则使用默认配置
  return getShareTimelineParams({
    type: 'search',
    data: searchKeyword.value,
  })
})

onMounted(() => {
  uni.pageScrollTo({ scrollTop: 0 })
})
</script>

<style scoped lang="scss">
/* 全局白色背景 */
.search-page {
  width: 100%;
  min-height: 100vh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  transition: padding-top 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); /* 更丝滑的过渡曲线 */
  padding-top: 60vh; /* 默认状态下顶部留白 */
  position: relative; /* 新增：作为brand-sign绝对定位的参考容器 */
}

/* 搜索状态时调整布局 */
.search-page.searching {
  padding-top: 180rpx; /* 搜索时顶部留白减小 */
}

/* 品牌文字/图片容器【关键修改2：适配图片样式，保留原动画和定位】 */
.brand-text {
  /* 保留原定位、动画、层级等属性 */
  position: absolute;
  top: 33vh;
  left: 50%;
  transform: translateX(-50%); /* 水平居中 */
  transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); /* 文字同步动画（可选） */
  z-index: 2;
  /* 调整尺寸适配图片，移除原文字相关样式 */
  margin-bottom: 80rpx;
  /* 核心：为容器添加倒影效果（作用于内部图片） */
  -webkit-box-reflect: below 8rpx linear-gradient(transparent, rgba(255, 69, 0, 0.3));
}

/* 品牌logo图片样式【新增】 */
.brand-logo-img {
  width: 300rpx; /* 可根据实际logo尺寸调整 */
  height: auto;
  display: block; /* 消除图片默认间隙 */
}

/* 搜索状态：品牌图片+倒影同步隐藏 */
.search-page.searching .brand-text {
  opacity: 0;
  transform: translateX(-50%) translateY(-20rpx);
  /* 倒影同步消失 */
  -webkit-box-reflect: below 8rpx linear-gradient(transparent, rgba(255, 69, 0, 0));
}

/* 品牌sign（非搜索状态：左橙右白各1/2渐变 + 影子效果） */
.brand-sign {
  font-size: 48rpx;
  color: #ff4500;
  position: absolute;
  /* 默认位置：顶部33vh 和 水平居中后右偏移10rpx */
  top: calc(33vh + 4rpx);
  left: 50%; /* calc(50% + 10rpx); 向右偏移10rpx，避开ComUni文字 */
  transform: translateX(-50%) translateZ(0); /* 水平居中，为滑动做基础 */
  width: 80rpx; /* 固定宽度，取消max-width，避免适配问题 */
  height: 80rpx;
  /* 修正渐变：左橙右白 */
  background: linear-gradient(to right, #ff4400f1 50%, #ffffff00 100%);
  border-radius: 50%; /* 改为正圆，视觉更统一 */
  padding: 3rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  /* 多属性同步过渡（位置+渐变+旋转，模拟滚动感） */
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  /* 核心修改：z-index: -1 让元素置于底层 */
  z-index: 1;
  /* 降低透明度，让底层图案更柔和，不抢视觉焦点 */
  opacity: 0.7;
}

/* 搜索状态：brand-sign 右滑+反向渐变+旋转 */
.search-page.searching .brand-sign {
  /* 右侧位置：顶部180rpx（和搜索栏对齐） + 右侧40rpx */
  top: 180rpx;
  left: auto; /* 取消left，改用right定位 */
  right: 40rpx;
  transform: translateX(0) rotate(90deg) translateZ(0);
  /* 反向渐变：左白右橙 */
  background: linear-gradient(to right, #ffffff00 30%, #ff4500 100%);
  opacity: 1;
}

/* 品牌sign内部（全透明） */
.brand-sign-internal {
  flex: 1;
  height: 100%;
  background-color: #ffffff00;
  border: none;
  outline: none;
  color: #ffffff00;
  font-size: 36rpx;
  border-radius: 50%; /* 改为正圆，匹配外层 */
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center; /* 内部内容居中 */
  padding: 0; /* 移除无效的padding-left */
}

/* 搜索框容器（橙红渐变边框） */
.search-input-wrapper {
  width: 90%;
  max-width: 680rpx;
  height: 80rpx;
  background: linear-gradient(90deg, #ff4500, #ff6347);
  border-radius: 40rpx;
  padding: 2rpx; /* 控制橙线粗细 */
  box-sizing: border-box;
  display: flex;
  align-items: center;
  transition:
    transform 0.3s ease,
    margin-top 0.3s ease;
}

/* 搜索输入框（纯白内部背景） */
.search-input {
  flex: 1;
  height: 100%;
  background-color: #ffffff;
  border: none;
  outline: none;
  color: #333333;
  font-size: 32rpx;
  padding-left: 40rpx;
  border-radius: 38rpx 0 0 38rpx;
  box-sizing: border-box;
}

/* 占位符样式（浅灰，适配白色背景） */
.search-input::placeholder {
  color: #999999;
  font-size: 30rpx;
}

/* 搜索触发按钮（纯白背景） */
.search-trigger {
  width: 80rpx;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border-radius: 0 38rpx 38rpx 0;
  color: #ff4500;
  font-size: 32rpx;
}

/* 加载动画 */
.loading-icon {
  font-size: 28rpx;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 结果提示（适配白色背景） */
.result-tip {
  margin-top: 60rpx;
  font-size: 28rpx;
  text-align: center;
  width: 100%;
  padding: 0 40rpx;
  box-sizing: border-box;
}

.success-tip {
  color: #666666;
}

.error-tip {
  color: #ff4500;
}

/* 搜索结果区域 */
.search-results {
  width: 90%;
  max-width: 680rpx;
  margin-top: 40rpx;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.section-title {
  font-size: 34rpx;
  color: #333;
  font-weight: 500;
  padding-left: 10rpx;
  border-left: 4rpx solid #ff4500;
}

.result-cards {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

/* 优化后的卡片样式 - 简约优雅 */
.result-card {
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0.03);
  padding: 24rpx;
  box-sizing: border-box;
  border: 1px solid #f5f5f5;
  transition: box-shadow 0.2s ease;
}

.result-card:hover {
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
  gap: 12rpx;
}

.card-title {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
  flex: 1;
  line-height: 1.4;
}

.add-btn.add-btn {
  background-color: #f9f9f9;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  color: #ff4500;
  border: 1px solid #ff4500;
  border-radius: 8rpx;
  padding: 6rpx 12rpx;
  font-size: 22rpx;
  height: auto;
  line-height: 1.2;
  flex-shrink: 0;
  transition: all 0.2s ease; // 新增过渡效果
}

/* 补充follow-btn完整样式 */
.add-btn.follow-btn {
  // 未关注状态基础样式
  &:not(.followed) {
    &:hover {
      background-color: #fff5f2; // 浅橙背景hover效果
      border-color: #ff5a28;
    }
    &:active {
      background-color: #ffe8df; // 点击按压效果
      border-color: #ff4500;
      transform: scale(0.96); // 轻微缩放反馈
    }
  }
  // 已关注状态样式优化
  &.followed {
    background-color: #ff4500;
    color: #fff;
    border-color: #ff4500;
    &:hover {
      background-color: #ff5a28; // 深一点的橙色hover
    }
    &:active {
      background-color: #e63e00; // 更深的橙色点击
      transform: scale(0.96);
    }
  }
}

/* 高亮样式 */
.highlight {
  color: #ff4500;
  background-color: rgba(255, 69, 0, 0.08);
  padding: 1rpx 3rpx;
  border-radius: 3rpx;
}

.card-content {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
  margin-bottom: 16rpx;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 22rpx;
  color: #999;
  flex-wrap: wrap;
  gap: 8rpx;
}

.view-btn {
  background-color: #ff4500;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  color: #fff;
  border-radius: 8rpx;
  padding: 6rpx 12rpx;
  font-size: 22rpx;
  height: auto;
  line-height: 1.2;
  border: none;
  flex-shrink: 0;
}

// 可选：给“隐藏”性别添加特殊样式
.user-info-item {
  .info-value {
    &.gender-hidden {
      color: #999;
      font-style: italic;
    }
  }
}

// 新增时间文本样式
.card-footer {
  .card-time {
    font-size: 22rpx;
    color: #999;
    margin: 0 8rpx;
  }
}

// 优化内容截取后的省略号样式
.card-content {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 5;
  -webkit-line-clamp: 5; // 最多显示5行
  -webkit-box-orient: vertical;
}

// 新增时间样式
.card-footer .card-time {
  margin: 0 8rpx;
  font-size: 22rpx;
  color: #999;
}

// 用户卡片样式
.user-card {
  .card-header {
    align-items: center;
    gap: 12rpx;
  }

  .user-avatar {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background-color: #ff450008;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    // 新增：头像图片样式
    .avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
    }

    // 调整文字头像样式（和user-detail保持一致）
    .avatar-text {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
      font-size: 26rpx;
      font-weight: 600;
    }

    .avatar-text text {
      color: #fff;
      font-size: 26rpx;
      font-weight: 600;
    }
  }

  .user-name {
    flex: 1;
    margin-left: 8rpx;
  }

  .user-content {
    .user-info-item {
      display: flex;
      margin-bottom: 8rpx;
      align-items: center;

      .info-label {
        color: #999;
        font-size: 24rpx;
        width: 100rpx;
        flex-shrink: 0;
      }

      .info-value {
        color: #666;
        font-size: 24rpx;
        flex: 1;
      }
    }
  }

  .user-footer {
    justify-content: flex-end;
  }
}

// 知识库卡片样式（新增）
.kb-card {
  .kb-footer {
    flex-wrap: wrap;
    gap: 8rpx;
  }
}

// 半屏弹窗样式（新增）
.knowledge-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 999;
  padding-bottom: env(safe-area-inset-bottom);
}

.knowledge-modal-content {
  width: 100%;
  max-height: 80vh;
  background-color: #fff;
  border-radius: 20rpx 20rpx 0 0;
  padding: 30rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1px solid #eee;

  .modal-title {
    font-size: 32rpx;
    color: #333;
    font-weight: 500;
  }

  .close-btn {
    -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
    width: 40rpx;
    height: 40rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    font-size: 36rpx;
    color: #999;
    padding: 0;
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;

  .loading-wrap {
    text-align: center;
    padding: 40rpx 0;
    color: #999;
    font-size: 28rpx;
  }

  .kb-list {
    display: flex;
    flex-direction: column;
    gap: 15rpx;
    margin-bottom: 30rpx;

    .kb-item {
      padding: 20rpx;
      border: 1px solid #eee;
      border-radius: 12rpx;
      transition: background-color 0.2s ease;
      -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效

      &:hover {
        background-color: #f9f9f9;
      }

      .kb-name {
        font-size: 28rpx;
        color: #333;
        font-weight: 500;
        margin-bottom: 5rpx;
        display: block;
      }

      .kb-desc {
        font-size: 24rpx;
        color: #999;
        display: block;
      }
    }
  }

  .empty-tip {
    text-align: center;
    padding: 40rpx 0;
    color: #999;
    font-size: 28rpx;
  }

  .new-kb-wrap {
    border-top: 1px solid #eee;
    padding-top: 20rpx;

    .new-kb-title {
      font-size: 28rpx;
      color: #333;
      margin-bottom: 15rpx;
      display: block;
    }

    .new-kb-input {
      width: 100%;
      height: 70rpx;
      border: 1px solid #eee;
      border-radius: 10rpx;
      padding: 0 20rpx;
      box-sizing: border-box;
      font-size: 28rpx;
      margin-bottom: 20rpx;
    }

    .create-kb-btn {
      width: 100%;
      height: 70rpx;
      background-color: #ff4500;
      color: #fff;
      border: none;
      border-radius: 10rpx;
      font-size: 28rpx;
      -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
    }

    .create-kb-btn.loading {
      background-color: #ff8c66;
    }
  }
}

/* ========== 就业政策与校招资源入口（首页初始态） ========== */
.resource-entry {
  width: 90%;
  max-width: 680rpx;
  margin-top: 40rpx;
  padding: 28rpx 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 6rpx 24rpx rgba(255, 69, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.2s ease;

  &:active {
    transform: translateY(2rpx);
  }
}

.resource-entry-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.resource-entry-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.resource-entry-texts {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.resource-entry-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 6rpx;
}

.resource-entry-desc {
  font-size: 22rpx;
  color: #9ca3af;
}

.resource-entry-arrow {
  font-size: 40rpx;
  color: #d1d5db;
  margin-left: 12rpx;
  line-height: 1;
}


/* ========== 退出搜索快捷操作 ========== */
.exit-search {
  margin-top: 24rpx;
  padding: 12rpx 32rpx;
  background: #ffffff;
  border: 2rpx solid #ff4500;
  border-radius: 40rpx;
  transition: background-color 0.2s ease;

  &:active {
    background: #fff3ef;
  }
}

.exit-search-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #ff4500;
}

/* ========== 本地检索结果（就业政策与校招资源） ========== */
.local-results {
  width: 90%;
  max-width: 680rpx;
  margin-top: 28rpx;
}

.local-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.local-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2937;
}

.local-count {
  font-size: 22rpx;
  color: #9ca3af;
}

.local-card {
  background: #ffffff;
  border-radius: 18rpx;
  padding: 24rpx 22rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.05);
  text-align: left;
  transition: transform 0.2s ease;

  &:active {
    transform: translateY(2rpx);
  }
}

.local-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.local-card-title {
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.5;
  padding-right: 14rpx;
}

.local-card-kind {
  flex-shrink: 0;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #f1f5f9;
  color: #6b7280;

  &.gov-doc {
    background: #fee2e2;
    color: #b91c1c;
  }

  &.official-platform {
    background: #dbeafe;
    color: #1d4ed8;
  }

  &.media {
    background: #fef3c7;
    color: #b45309;
  }

  &.own {
    background: #e0f2fe;
    color: #0369a1;
  }
}

.local-card-meta {
  display: block;
  font-size: 21rpx;
  color: #9ca3af;
  margin-bottom: 12rpx;
}

.local-card-summary {
  display: block;
  font-size: 24rpx;
  color: #4b5563;
  line-height: 1.7;
  margin-bottom: 14rpx;
}

.local-tags {
  display: flex;
  flex-wrap: wrap;
}

.local-tag {
  font-size: 20rpx;
  color: #6b7280;
  background: #f1f5f9;
  border-radius: 20rpx;
  padding: 4rpx 16rpx;
  margin: 0 10rpx 8rpx 0;
}

.local-more {
  padding: 16rpx 0;
  text-align: center;
}

.local-more-text {
  font-size: 25rpx;
  color: #ff4500;
  font-weight: 600;
}

/* ========== 未登录提示 ========== */
.site-login-tip {
  width: 90%;
  max-width: 680rpx;
  margin-top: 24rpx;
  padding: 24rpx;
  background: #f8fafc;
  border-radius: 16rpx;
  border-left: 6rpx solid #cbd5e1;
}

.site-login-text {
  display: block;
  font-size: 23rpx;
  color: #6b7280;
  line-height: 1.7;
  margin-bottom: 16rpx;
}

.site-login-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #3b82f6;
  border-radius: 32rpx;
  padding: 12rpx 36rpx;

  &:active {
    opacity: 0.85;
  }
}

.site-login-btn-text {
  font-size: 25rpx;
  font-weight: 600;
  color: #ffffff;
}
</style>
