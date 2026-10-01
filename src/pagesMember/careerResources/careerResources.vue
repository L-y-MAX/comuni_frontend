<template>
  <view class="cr-page">
    <!-- ========== 头部说明 ========== -->
    <view class="cr-hero">
      <text class="cr-hero-title">就业政策与校招资源</text>
      <text class="cr-hero-sub">
        结构化整理的离线资源库：官方来源、定位说明、一键复制官方链接。
        不转载原文，不确定的条款一律不写。
      </text>
      <view class="cr-hero-stats">
        <view class="cr-stat">
          <text class="cr-stat-num">{{ CAREER_RESOURCES.length }}</text>
          <text class="cr-stat-label">条资源</text>
        </view>
        <view class="cr-stat-divider"></view>
        <view class="cr-stat">
          <text class="cr-stat-num">{{ officialCount }}</text>
          <text class="cr-stat-label">官方来源</text>
        </view>
        <view class="cr-stat-divider"></view>
        <view class="cr-stat">
          <text class="cr-stat-num">{{ themeList.length }}</text>
          <text class="cr-stat-label">个主题</text>
        </view>
      </view>
    </view>

    <!-- 当前分类的辅助说明（分类改由右侧抽屉选择，入口是「政策类型速查」标题行右侧的筛选按钮） -->
    <text class="cr-theme-desc">{{ currentThemeMeta.desc }}</text>

    <!-- ========== 检索 ========== -->
    <view class="cr-search">
      <text class="cr-search-icon">🔍</text>
      <input
        v-model="keyword"
        class="cr-search-input"
        type="text"
        placeholder="搜索标题、发布机构或标签"
        placeholder-class="cr-search-ph"
        confirm-type="search"
      />
      <text
        v-if="keyword"
        class="cr-search-clear"
        @tap="keyword = ''"
      >
        ✕
      </text>
    </view>

    <!-- ========== 政策类型速查（仅政策主题） ========== -->
    <view
      v-if="activeTheme === 'policy'"
      class="cr-card cr-cats"
    >
      <view class="cr-cats-head">
        <text class="cr-section-title">政策类型速查</text>
        <!-- 原「点标签筛选相关文件」小字改为筛选按钮，点击唤起右侧抽屉 -->
        <view
          class="cr-filter-btn"
          @tap="openDrawer"
        >
          <text class="cr-filter-btn-icon">≡</text>
          <text class="cr-filter-btn-text">筛选</text>
        </view>
      </view>
      <view class="cr-cat-list">
        <view
          v-for="c in POLICY_CATEGORIES"
          :key="c.name"
          class="cr-cat"
          :class="{ active: activeTag === c.tag }"
          @tap="toggleTag(c.tag)"
        >
          <text class="cr-cat-name">{{ c.name }}</text>
          <text class="cr-cat-audience">面向：{{ c.audience }}</text>
          <text class="cr-cat-desc">{{ c.desc }}</text>
        </view>
      </view>
      <text class="cr-cats-foot">
        以上为方向性归类，不含金额与时限数字。具体标准请以官方原文为准。
      </text>
    </view>

    <!-- ========== 筛选状态 ========== -->
    <view
      v-if="activeTag || keyword"
      class="cr-filter-bar"
    >
      <text class="cr-filter-text">
        筛选：{{ filterText }}　命中 {{ visibleList.length }} / {{ themeTotal }} 条
      </text>
      <text
        class="cr-filter-reset"
        @tap="resetFilter"
      >
        清除
      </text>
    </view>

    <!-- ========== 资源列表 ========== -->
    <view class="cr-list">
      <view
        v-for="item in visibleList"
        :key="item.id"
        class="cr-card cr-item"
      >
        <view class="cr-item-head">
          <text class="cr-item-title">{{ item.title }}</text>
          <text
            class="cr-kind"
            :class="item.kind"
          >
            {{ kindLabel(item.kind) }}
          </text>
        </view>

        <view class="cr-meta">
          <text class="cr-meta-source">{{ item.source }}</text>
          <text
            v-if="item.docNo"
            class="cr-meta-docno"
          >
            {{ item.docNo }}
          </text>
          <text
            v-if="item.date"
            class="cr-meta-date"
          >
            {{ item.date }}
          </text>
        </view>

        <text class="cr-summary">{{ item.summary }}</text>

        <view
          v-if="item.advice"
          class="cr-advice"
        >
          <text class="cr-advice-label">怎么用</text>
          <text class="cr-advice-text">{{ item.advice }}</text>
        </view>

        <view class="cr-tags">
          <text
            v-for="g in item.tags"
            :key="g"
            class="cr-tag"
            :class="{ active: activeTag === g }"
            @tap="toggleTag(g)"
          >
            {{ g }}
          </text>
        </view>

        <view
          v-if="item.url"
          class="cr-actions"
        >
          <view
            class="cr-btn"
            @tap="copyLink(item)"
          >
            <text class="cr-btn-text">复制官方链接</text>
          </view>
          <text class="cr-action-hint">小程序内不能直接打开外部网页，复制后请在浏览器访问</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view
        v-if="!visibleList.length"
        class="cr-card cr-empty"
      >
        <text class="cr-empty-title">没有匹配的资源</text>
        <text class="cr-empty-desc">换个关键词，或点上面的「清除」看全部 {{ themeTotal }} 条。</text>
      </view>
    </view>

    <!-- ========== 与求职闭环的联动 ========== -->
    <view class="cr-card cr-linkage">
      <text class="cr-section-title">怎么和本小程序的其他功能配合用</text>
      <text class="cr-linkage-text">{{ RESOURCE_LINKAGE_NOTE }}</text>
    </view>

    <!-- ========== 来源与免责声明 ========== -->
    <view class="cr-card cr-disclaimer">
      <text class="cr-disclaimer-title">来源与免责说明</text>
      <view class="cr-disclaimer-list">
        <text class="cr-disclaimer-item">
          · 本页为公开信息的结构化整理，只提供来源机构、定位说明与官方链接，
          不转载政策与校方文件原文。
        </text>
        <text class="cr-disclaimer-item">
          · 角标含义：「官方文件」为政府部门发文；「官方平台」为政府或学校官方站点；
          「媒体报道」为公开新闻；「平台整理」为本平台原创的求职方法总结。
        </text>
        <text class="cr-disclaimer-item">
          · 补贴标准、申领条件与申报时限可能调整，请以官方原文及受理部门答复为准。
        </text>
        <text class="cr-disclaimer-item">
          · 校招企业与岗位以学校就业服务平台实时发布为准，本页不缓存企业名单。
        </text>
      </view>
    </view>

    <!-- ====================== 分类筛选抽屉（右侧滑入） ====================== -->
    <!-- 遮罩：半透明黑色，点击关闭；阻止滚动穿透 -->
    <view
      v-if="drawerOpen"
      class="cr-mask"
      @tap="closeDrawer"
      @touchmove.stop.prevent
    ></view>

    <!-- 抽屉本体：常驻 DOM，靠 transform 做右滑入场 / 退场 -->
    <view
      class="cr-drawer"
      :class="{ open: drawerOpen }"
    >
      <!-- 1. 头部：标题 + 关闭叉号 -->
      <view class="cr-drawer-head">
        <text class="cr-drawer-title">资源分类筛选</text>
        <text
          class="cr-drawer-close"
          @tap="closeDrawer"
        >
          ✕
        </text>
      </view>

      <!-- 2. 选项区：单选互斥、纵向排列；选项变多时面板内部纵向滚动 -->
      <scroll-view
        class="cr-drawer-body"
        scroll-y
      >
        <view
          v-for="t in themeList"
          :key="t.key"
          class="cr-opt"
          :class="{ active: draftTheme === t.key }"
          @tap="pickDraftTheme(t.key)"
        >
          <text
            class="cr-opt-check"
            :class="{ on: draftTheme === t.key }"
          >
            {{ draftTheme === t.key ? '✓' : '○' }}
          </text>
          <text class="cr-opt-icon">{{ t.icon }}</text>
          <text class="cr-opt-label">{{ t.label }}</text>
        </view>
      </scroll-view>

      <!-- 3. 底部操作区：重置 / 确认 -->
      <view class="cr-drawer-foot">
        <view
          class="cr-btn-reset"
          @tap="resetDrawer"
        >
          <text class="cr-btn-reset-text">重置</text>
        </view>
        <view
          class="cr-btn-confirm"
          @tap="confirmDrawer"
        >
          <text class="cr-btn-confirm-text">确认</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import {
  CAREER_RESOURCES,
  POLICY_CATEGORIES,
  RESOURCE_LINKAGE_NOTE,
  filterResources,
  resourcesByTheme,
} from '@/utils/careerResources';
import {
  RESOURCE_KIND_LABEL,
  RESOURCE_THEMES,
  type CareerResource,
  type ResourceKind,
  type ResourceTag,
  type ResourceTheme,
} from '@/types/careerResource';

// ====================== 主题 ======================

const themeList = RESOURCE_THEMES;
const activeTheme = ref<ResourceTheme>('policy');

const currentThemeMeta = computed(
  () => themeList.find((t) => t.key === activeTheme.value) ?? themeList[0]
);

/** 该主题下的全部条目数（未筛选） */
const themeTotal = computed(() => resourcesByTheme(activeTheme.value).length);

/** 官方来源条数（官方文件 + 官方平台），用于头部统计 */
const officialCount = computed(
  () => CAREER_RESOURCES.filter((r) => r.kind === 'gov-doc' || r.kind === 'official-platform').length
);

// ====================== 检索 ======================

const keyword = ref('');
const activeTag = ref<ResourceTag | ''>('');

/**
 * 当前展示的列表。
 * 口径：先按主题取，再按标签收窄，最后按关键词过滤。
 * 标签与关键词是「与」的关系，避免出现「筛了标签却仍混进无关条目」。
 */
const visibleList = computed<CareerResource[]>(() => {
  let list = resourcesByTheme(activeTheme.value);
  if (activeTag.value) list = list.filter((r) => r.tags.includes(activeTag.value as ResourceTag));
  return filterResources(list, keyword.value);
});

const filterText = computed(() => {
  const parts: string[] = [];
  if (activeTag.value) parts.push(`标签「${activeTag.value}」`);
  if (keyword.value.trim()) parts.push(`关键词「${keyword.value.trim()}」`);
  return parts.join(' + ');
});

// ====================== 交互 ======================

const switchTheme = (key: ResourceTheme) => {
  activeTheme.value = key;
  // 切换主题时清掉标签筛选：标签是跨主题共用的，
  // 带着「补贴」跳到「简历与面试指导」会得到空列表，容易让人以为页面坏了。
  activeTag.value = '';
};

const toggleTag = (tag: ResourceTag) => {
  activeTag.value = activeTag.value === tag ? '' : tag;
  if (activeTheme.value === 'policy' && activeTag.value) {
    // 政策主题下点标签后滚到列表，方便马上看到结果
    setTimeout(() => uni.pageScrollTo({ scrollTop: 600, duration: 200 }), 50);
  }
};

const resetFilter = () => {
  activeTag.value = '';
  keyword.value = '';
};

// ====================== 分类筛选抽屉 ======================

/** 抽屉是否打开 */
const drawerOpen = ref(false);

/**
 * 抽屉里的「草稿」选择。
 * 点【确认】才真正生效；直接关闭抽屉（遮罩 / 叉号）则丢弃草稿，
 * 这样用户误触分类不会立刻打乱正在看的列表。
 */
const draftTheme = ref<ResourceTheme>('policy');

/** 打开抽屉：自动读取当前分类并勾选（选中态记忆） */
const openDrawer = () => {
  draftTheme.value = activeTheme.value;
  drawerOpen.value = true;
};

/** 关闭抽屉（不保存草稿） */
const closeDrawer = () => {
  drawerOpen.value = false;
};

/** 抽屉内选择分类：单选互斥，点谁选谁 */
const pickDraftTheme = (key: ResourceTheme) => {
  draftTheme.value = key;
};

/** 确认：保存选择 → 关闭抽屉 → 主列表随之刷新为对应分类 */
const confirmDrawer = () => {
  switchTheme(draftTheme.value);
  drawerOpen.value = false;
};

/** 重置：恢复默认分类「就业政策」并关闭抽屉（按规格，重置也会关闭抽屉） */
const resetDrawer = () => {
  draftTheme.value = 'policy';
  switchTheme('policy');
  drawerOpen.value = false;
};

const kindLabel = (kind: ResourceKind): string => RESOURCE_KIND_LABEL[kind] ?? '';

/**
 * 支持从首页搜索结果带 ?focus=<id> 直接定位到某一条：
 * 切到它所属主题并把关键词设成它的标题，列表里就只剩这一条。
 */
onLoad((options) => {
  const focus = options?.focus ? decodeURIComponent(options.focus) : '';
  if (!focus) return;
  const hit = CAREER_RESOURCES.find((r) => r.id === focus);
  if (!hit) return;
  activeTheme.value = hit.theme;
  activeTag.value = '';
  keyword.value = hit.title;
});

const copyLink = (item: CareerResource) => {
  if (!item.url) return;
  uni.setClipboardData({
    data: item.url,
    success: () => {
      uni.showToast({ title: '官方链接已复制', icon: 'none', duration: 2000 });
    },
    fail: () => {
      // 复制失败时把链接显示出来，保证用户仍能拿到
      uni.showModal({
        title: '复制失败',
        content: item.url as string,
        showCancel: false,
      });
    },
  });
};
</script>

<style scoped lang="scss">
$primary: #ff4500;
$primary-light: #ff9a7a;
$primary-soft: #fff3ef;
$text-1: #1f2937;
$text-2: #6b7280;
$text-3: #9ca3af;
$line: #f1f5f9;
$bg: #f7f8fa;

.cr-page {
  min-height: 100vh;
  background: $bg;
  padding: 24rpx 24rpx 60rpx;
  box-sizing: border-box;
}

.cr-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
}

// ========== 头部 ==========
.cr-hero {
  background: linear-gradient(135deg, #ff7a4d 0%, $primary 100%);
  border-radius: 24rpx;
  padding: 36rpx 28rpx 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 10rpx 28rpx rgba(255, 69, 0, 0.22);
}

.cr-hero-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12rpx;
}

.cr-hero-sub {
  display: block;
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.92);
}

.cr-hero-stats {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.3);
}

.cr-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cr-stat-num {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
}

.cr-stat-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 4rpx;
}

.cr-stat-divider {
  width: 1rpx;
  height: 48rpx;
  background: rgba(255, 255, 255, 0.3);
}

// ========== 当前分类辅助说明 ==========
.cr-theme-desc {
  display: block;
  font-size: 22rpx;
  color: $text-3;
  line-height: 1.6;
  padding: 0 8rpx 20rpx;
}

// ========== 检索 ==========
.cr-search {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 40rpx;
  padding: 0 24rpx;
  height: 80rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.cr-search-icon {
  font-size: 26rpx;
  margin-right: 12rpx;
}

.cr-search-input {
  flex: 1;
  font-size: 28rpx;
  color: $text-1;
}

.cr-search-ph {
  color: $text-3;
  font-size: 26rpx;
}

.cr-search-clear {
  font-size: 28rpx;
  color: $text-3;
  padding: 10rpx;
}

// ========== 政策速查 ==========
.cr-cats {
  margin-bottom: 24rpx;
}

.cr-cats-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.cr-section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: $text-1;
}

.cr-section-note {
  font-size: 22rpx;
  color: $text-3;
}

/* ========== 筛选按钮（速查标题行右侧） ========== */
.cr-filter-btn {
  display: flex;
  align-items: center;
  padding: 8rpx 22rpx;
  border-radius: 30rpx;
  background: $primary-soft;
  border: 2rpx solid $primary-light;

  &:active {
    opacity: 0.85;
  }
}

.cr-filter-btn-icon {
  font-size: 26rpx;
  color: $primary;
  margin-right: 8rpx;
  line-height: 1;
}

.cr-filter-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: $primary;
}

/* ====================== 分类筛选抽屉 ====================== */
/* 遮罩：半透明黑，淡入 */
.cr-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  animation: cr-mask-in 0.3s ease;
}

@keyframes cr-mask-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 抽屉本体：右侧滑入，圆角只在左上/左下 */
.cr-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 70%;
  max-width: 420rpx;
  background: #ffffff;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  border-radius: 28rpx 0 0 28rpx;
  box-shadow: -8rpx 0 32rpx rgba(0, 0, 0, 0.16);
  transform: translateX(104%);
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

  &.open {
    transform: translateX(0);
  }
}

/* 头部 */
.cr-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 28rpx 24rpx;
  border-bottom: 1rpx solid $line;
  flex-shrink: 0;
}

.cr-drawer-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $text-1;
}

.cr-drawer-close {
  font-size: 30rpx;
  color: $text-3;
  padding: 8rpx 12rpx;
  line-height: 1;
}

/* 选项区 */
.cr-drawer-body {
  flex: 1;
  padding: 20rpx 24rpx;
  box-sizing: border-box;
}

.cr-opt {
  display: flex;
  align-items: center;
  padding: 26rpx 18rpx;
  border-radius: 16rpx;
  background: #ffffff;
  border: 2rpx solid transparent;
  margin-bottom: 14rpx;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  /* 选中态：浅橙底 + 橙色文字 + 橙色对勾 */
  &.active {
    background: $primary-soft;
    border-color: $primary-light;

    .cr-opt-label {
      color: $primary;
      font-weight: 600;
    }
  }

  &:active {
    background: #fafbfc;
  }
}

.cr-opt-check {
  width: 34rpx;
  font-size: 26rpx;
  color: #d1d5db;
  line-height: 1;

  &.on {
    color: $primary;
    font-weight: 700;
  }
}

.cr-opt-icon {
  font-size: 32rpx;
  margin-right: 14rpx;
}

.cr-opt-label {
  flex: 1;
  font-size: 28rpx;
  color: $text-2;
}

/* 底部操作区：固定在抽屉底部 */
.cr-drawer-foot {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid $line;
  flex-shrink: 0;
}

.cr-btn-reset,
.cr-btn-confirm {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 76rpx;
  border-radius: 38rpx;

  &:active {
    opacity: 0.85;
  }
}

.cr-btn-reset {
  background: #ffffff;
  border: 2rpx solid #e5e7eb;
}

.cr-btn-reset-text {
  font-size: 28rpx;
  color: $text-2;
}

.cr-btn-confirm {
  background: $primary;
}

.cr-btn-confirm-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #ffffff;
}

.cr-cat-list {
  display: flex;
  flex-direction: column;
}

.cr-cat {
  padding: 20rpx;
  border-radius: 14rpx;
  background: #fafbfc;
  border: 2rpx solid transparent;
  margin-bottom: 12rpx;

  &.active {
    background: $primary-soft;
    border-color: $primary-light;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.cr-cat-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-1;
  margin-bottom: 6rpx;

  .cr-cat.active & {
    color: $primary;
  }
}

.cr-cat-audience {
  display: block;
  font-size: 22rpx;
  color: $primary-light;
  margin-bottom: 6rpx;
}

.cr-cat-desc {
  display: block;
  font-size: 24rpx;
  color: $text-2;
  line-height: 1.6;
}

.cr-cats-foot {
  display: block;
  font-size: 22rpx;
  color: $text-3;
  line-height: 1.6;
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $line;
}

// ========== 筛选条 ==========
.cr-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $primary-soft;
  border-radius: 14rpx;
  padding: 16rpx 24rpx;
  margin-bottom: 20rpx;
}

.cr-filter-text {
  font-size: 24rpx;
  color: $primary;
  flex: 1;
}

.cr-filter-reset {
  font-size: 24rpx;
  color: $text-2;
  padding-left: 20rpx;
  text-decoration: underline;
}

// ========== 资源列表 ==========
.cr-list {
  display: flex;
  flex-direction: column;
}

.cr-item {
  margin-bottom: 20rpx;
}

.cr-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.cr-item-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: $text-1;
  line-height: 1.5;
  padding-right: 16rpx;
}

.cr-kind {
  flex-shrink: 0;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #f1f5f9;
  color: $text-2;

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

.cr-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 14rpx;
}

.cr-meta-source {
  font-size: 22rpx;
  color: $text-2;
}

.cr-meta-docno,
.cr-meta-date {
  font-size: 22rpx;
  color: $text-3;
  margin-left: 16rpx;
}

.cr-summary {
  display: block;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.75;
  margin-bottom: 16rpx;
}

.cr-advice {
  background: #f8fafc;
  border-left: 6rpx solid $primary-light;
  border-radius: 10rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}

.cr-advice-label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: $primary;
  margin-bottom: 6rpx;
}

.cr-advice-text {
  display: block;
  font-size: 24rpx;
  color: $text-2;
  line-height: 1.7;
}

.cr-tags {
  display: flex;
  flex-wrap: wrap;
}

.cr-tag {
  font-size: 22rpx;
  color: $text-2;
  background: #f1f5f9;
  border-radius: 24rpx;
  padding: 6rpx 18rpx;
  margin: 0 12rpx 10rpx 0;

  &.active {
    background: $primary;
    color: #fff;
  }
}

.cr-actions {
  margin-top: 8rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $line;
}

.cr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $primary;
  border-radius: 40rpx;
  padding: 16rpx 32rpx;

  &:active {
    opacity: 0.85;
  }
}

.cr-btn-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}

.cr-action-hint {
  display: block;
  font-size: 20rpx;
  color: $text-3;
  margin-top: 12rpx;
  line-height: 1.6;
}

// ========== 空状态 ==========
.cr-empty {
  align-items: center;
  padding: 60rpx 28rpx;
}

.cr-empty-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-2;
  text-align: center;
  margin-bottom: 10rpx;
}

.cr-empty-desc {
  display: block;
  font-size: 24rpx;
  color: $text-3;
  text-align: center;
  line-height: 1.7;
}

// ========== 联动 / 免责 ==========
.cr-linkage {
  margin-bottom: 20rpx;
  background: $primary-soft;
  box-shadow: none;
}

.cr-linkage-text {
  display: block;
  font-size: 25rpx;
  color: #7c2d12;
  line-height: 1.8;
  margin-top: 12rpx;
}

.cr-disclaimer {
  background: #fff;
}

.cr-disclaimer-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: $text-2;
  margin-bottom: 14rpx;
}

.cr-disclaimer-list {
  display: flex;
  flex-direction: column;
}

.cr-disclaimer-item {
  display: block;
  font-size: 23rpx;
  color: $text-3;
  line-height: 1.8;
  margin-bottom: 8rpx;
}
</style>
