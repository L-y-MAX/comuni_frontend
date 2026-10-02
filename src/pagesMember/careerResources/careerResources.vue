<template>
  <view
    class="cr-page"
    :style="{ paddingTop: navTotalHeight + 'px' }"
  >
    <!-- ============================================================
         1. 顶部导航栏
         - 左上角：返回箭头
         - 中间：页面标题
         - 右上角：留出与微信原生胶囊（三个点 + 圆形按钮）等宽的空位，
           这样标题在视觉上仍然居中，且不会被胶囊压住
         ============================================================ -->
    <view
      class="custom-nav"
      :style="{ paddingTop: statusBarHeight + 'px' }"
    >
      <view
        class="nav-inner"
        :style="{ height: navBarHeight + 'px' }"
      >
        <view
          class="nav-left"
          :style="{ width: sideWidth + 'px' }"
          @tap="goBack"
        >
          <text class="nav-back">‹</text>
        </view>

        <text class="nav-title">就业政策与校招资源</text>

        <!-- 右侧仅占位：微信胶囊由原生渲染在这里 -->
        <view
          class="nav-right"
          :style="{ width: sideWidth + 'px' }"
        ></view>
      </view>
    </view>

    <!-- ============================================================
         2. 橙色顶部大卡片：主标题 + 描述 + 三栏统计
         ============================================================ -->
    <view class="hero">
      <text class="hero-title">就业政策与校招资源</text>
      <text class="hero-desc">
        结构化整理的离线资源库：官方来源、定位说明、一键复制官方链接。不转载原文，不确定的条款一律不写。
      </text>

      <view class="hero-stats">
        <view
          v-for="s in heroStats"
          :key="s.label"
          class="hero-stat"
        >
          <text class="hero-stat-num">{{ s.value }}</text>
          <text class="hero-stat-label">{{ s.label }}</text>
        </view>
      </view>
    </view>

    <!-- ============================================================
         3. 分类标签横向卡片组（3 个）
         选中态：浅橙底 + 橙色文字；未选中：白底 + 灰色文字
         ============================================================ -->
    <view class="theme-row">
      <view
        v-for="t in themeList"
        :key="t.key"
        class="theme-card"
        :class="{ active: activeTheme === t.key }"
        @tap="switchTheme(t.key)"
      >
        <image
          class="theme-icon-img"
          :src="t.icon"
          mode="aspectFit"
        />
        <text class="theme-label">{{ t.label }}</text>
      </view>
    </view>

    <!-- 选中分类的辅助说明（浅灰小字） -->
    <text class="theme-desc">{{ currentThemeMeta.desc }}</text>

    <!-- ============================================================
         4. 搜索框：放大镜 + 输入 + 清除叉号
         ============================================================ -->
    <view class="search-box">
      <!-- 搜索图标：优先用本地 search.png，缺图自动退回 🔍 -->
      <image
        v-if="!searchIconError"
        class="search-icon search-icon-img"
        src="/static/home/search.png"
        mode="aspectFit"
        @error="searchIconError = true"
      />
      <text
        v-else
        class="search-icon"
      >
        🔍
      </text>
      <input
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="搜索关键词，如：补贴"
        placeholder-class="search-ph"
        confirm-type="search"
      />
      <view
        v-if="keyword"
        class="search-clear"
        @tap="clearKeyword"
      >
        <text class="search-clear-icon">✕</text>
      </view>
    </view>

    <!-- ============================================================
         5. 政策类型速查（仅「就业政策」分类下展示）
         标题行：左标题 + 右提示；卡片点击 = 按标签筛选（mock 交互，不跳详情页）
         ============================================================ -->
    <view
      v-if="activeTheme === 'policy'"
      class="section"
    >
      <view class="section-head">
        <text class="section-title">政策类型速查</text>
        <text class="section-hint">点标签筛选相关文件</text>
      </view>

      <view
        v-for="c in POLICY_CATEGORIES"
        :key="c.name"
        class="cat-card"
        :class="{ active: activeTag === c.tag }"
        @tap="onCategoryTap(c)"
      >
        <text class="cat-name">{{ c.name }}</text>
        <text class="cat-audience">面向：{{ c.audience }}</text>
        <text class="cat-desc">{{ c.desc }}</text>
      </view>

      <text class="section-foot">
        以上为方向性归类，不含金额与时限数字。具体标准请以官方原文为准。
      </text>
    </view>

    <!-- ============================================================
         6. 资源列表（政策文件 / 校招渠道 / 求职指导）
         ============================================================ -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">{{ listTitle }}</text>
        <text class="section-hint">
          {{ visibleList.length }} / {{ themeTotal }} 条
        </text>
      </view>

      <!-- 当前筛选状态 -->
      <view
        v-if="filterText"
        class="filter-bar"
      >
        <text class="filter-text">筛选：{{ filterText }}</text>
        <text
          class="filter-reset"
          @tap="resetFilter"
        >
          清除
        </text>
      </view>

      <view
        v-for="item in visibleList"
        :key="item.id"
        class="res-card"
        @tap="onResourceTap(item)"
      >
        <view class="res-head">
          <text class="res-title">{{ item.title }}</text>
          <text
            class="res-kind"
            :class="item.kind"
          >
            {{ kindLabel(item.kind) }}
          </text>
        </view>

        <text class="res-meta">
          {{ item.source }}<text v-if="item.docNo"> · {{ item.docNo }}</text>
        </text>

        <text class="res-summary">{{ item.summary }}</text>

        <view
          v-if="item.advice"
          class="res-advice"
        >
          <text class="res-advice-label">怎么用</text>
          <text class="res-advice-text">{{ item.advice }}</text>
        </view>

        <view class="res-tags">
          <text
            v-for="g in item.tags"
            :key="g"
            class="res-tag"
            :class="{ active: activeTag === g }"
            @tap.stop="toggleTag(g)"
          >
            {{ g }}
          </text>
        </view>

        <view
          v-if="item.url"
          class="res-actions"
        >
          <view
            class="copy-btn"
            @tap.stop="copyLink(item)"
          >
            <text class="copy-btn-text">复制官方链接</text>
          </view>
          <text class="copy-hint">小程序内不能直接打开外部网页，复制后请在浏览器访问</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view
        v-if="!visibleList.length"
        class="empty-card"
      >
        <text class="empty-title">没有匹配的资源</text>
        <text class="empty-desc">换个关键词，或点上面的「清除」看全部 {{ themeTotal }} 条。</text>
      </view>
    </view>

    <!-- ============================================================
         7. 联动说明 + 来源与免责
         ============================================================ -->
    <view class="linkage-card">
      <text class="linkage-title">怎么和本小程序的其他功能配合用</text>
      <text class="linkage-text">{{ RESOURCE_LINKAGE_NOTE }}</text>
    </view>

    <view class="disclaimer-card">
      <text class="disclaimer-title">来源与免责说明</text>
      <text
        v-for="(d, i) in DISCLAIMERS"
        :key="i"
        class="disclaimer-item"
      >
        · {{ d }}
      </text>
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
  type PolicyCategory,
  type ResourceKind,
  type ResourceTag,
  type ResourceTheme,
} from '@/types/careerResource';

// ====================== 静态文案 ======================

/**
 * 来源与免责说明。
 * 本页只做「来源 + 定位 + 官方链接」，不转载原文，因此免责说明必须常驻页面。
 */
const DISCLAIMERS = [
  '本页为公开信息的结构化整理，只提供来源机构、定位说明与官方链接，不转载政策与校方文件原文。',
  '角标含义：「官方文件」为政府部门发文；「官方平台」为政府或学校官方站点；「媒体报道」为公开新闻；「平台整理」为本平台原创的求职方法总结。',
  '补贴标准、申领条件与申报时限可能调整，请以官方原文及受理部门答复为准。',
  '校招企业与岗位以学校就业服务平台实时发布为准，本页不缓存企业名单。',
];

// ====================== 顶部导航栏尺寸 ======================

const statusBarHeight = ref(20); // 状态栏高度（px）
const navBarHeight = ref(44); // 标题栏高度（px）
const sideWidth = ref(88); // 左右占位宽度（px），右侧用于避开微信原生胶囊

/** 导航栏占用的总高度，页面内容据此下移，避免被固定导航栏遮住 */
const navTotalHeight = computed(() => statusBarHeight.value + navBarHeight.value);

/**
 * 读取状态栏与胶囊位置。
 *
 * 小程序无法隐藏右上角原生胶囊（三个点 + 圆形按钮），
 * 只能把标题栏的左右占位设成与胶囊等宽，让标题在视觉上保持居中且不被遮挡。
 * 任何一步取不到值都用默认值兜底，绝不让页面因此报错。
 */
const initNavMetrics = () => {
  try {
    const win = (uni.getWindowInfo?.() ?? uni.getSystemInfoSync?.() ?? {}) as {
      statusBarHeight?: number;
      windowWidth?: number;
    };
    if (typeof win.statusBarHeight === 'number' && win.statusBarHeight > 0) {
      statusBarHeight.value = win.statusBarHeight;
    }

    const rect = (
      uni as unknown as {
        getMenuButtonBoundingClientRect?: () => {
          top: number;
          height: number;
          left: number;
          width: number;
        };
      }
    ).getMenuButtonBoundingClientRect?.();

    if (rect && rect.height > 0 && rect.top > 0) {
      // 标题栏高度 = 胶囊上下留白 × 2 + 胶囊高度（微信官方推荐的算法）
      navBarHeight.value = (rect.top - statusBarHeight.value) * 2 + rect.height;
      const windowWidth = win.windowWidth ?? 375;
      // 从胶囊左边缘到屏幕右边缘 = 胶囊宽度 + 右侧留白
      sideWidth.value = Math.max(60, windowWidth - rect.left);
    }
  } catch {
    // 取不到就用默认值，不影响页面可用性
  }
};

/** 返回上一页；没有上一页时（例如从分享卡片直接进入）回到首页 */
const goBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.switchTab({ url: '/pages/index/index' });
  }
};

// ====================== 主题（分类标签） ======================

const themeList = RESOURCE_THEMES;
const activeTheme = ref<ResourceTheme>('policy');

const currentThemeMeta = computed(
  () => themeList.find((t) => t.key === activeTheme.value) ?? themeList[0]
);

/** 该主题下的全部条目数（未筛选） */
const themeTotal = computed(() => resourcesByTheme(activeTheme.value).length);

/** 列表标题随分类变化 */
const LIST_TITLES: Record<ResourceTheme, string> = {
  policy: '政策文件与官方来源',
  campus: '校招渠道与企业线索',
  guide: '求职实务指导',
};
const listTitle = computed(() => LIST_TITLES[activeTheme.value] ?? '资源列表');

// ====================== 三栏统计 ======================

/** 官方来源 = 非「平台整理」的条目（官方文件 / 官方平台 / 媒体报道之外的都算） */
const officialCount = computed(
  () => CAREER_RESOURCES.filter((r) => r.kind === 'gov-doc' || r.kind === 'official-platform').length
);

/** 顶部统计：数字在上、文字在下 */
const heroStats = computed(() => [
  { value: CAREER_RESOURCES.length, label: '条资源' },
  { value: officialCount.value, label: '官方来源' },
  { value: themeList.length, label: '个主题' },
]);

// ====================== 搜索与筛选 ======================

/**
 * 搜索关键词。
 * 按设计稿预填「就业」——它命中全部 8 条政策文件，所以看起来仍是完整列表，
 * 只是想演示「输入框有内容 + 右侧有清除叉号」的状态。清空后即为全部资源。
 */
const keyword = ref('');

/** 搜索图标加载失败时退回 emoji，避免出现破图 */
const searchIconError = ref(false);

/** 当前标签筛选（跨分类共用） */
const activeTag = ref<ResourceTag | ''>('');

/**
 * 当前展示的资源列表。
 * 口径：先按分类取，再按标签收窄，最后按关键词过滤；
 * 标签与关键词是「与」的关系，避免出现「筛了标签却混进无关条目」。
 */
const visibleList = computed<CareerResource[]>(() => {
  let list = resourcesByTheme(activeTheme.value);
  if (activeTag.value) list = list.filter((r) => r.tags.includes(activeTag.value as ResourceTag));
  return filterResources(list, keyword.value);
});

/** 筛选状态文案，无筛选时为空串（界面据此隐藏筛选条） */
const filterText = computed(() => {
  const parts: string[] = [];
  if (activeTag.value) parts.push(`标签「${activeTag.value}」`);
  if (keyword.value.trim()) parts.push(`关键词「${keyword.value.trim()}」`);
  return parts.join(' + ');
});

// ====================== 交互 ======================

/** 切换分类：同时清掉标签筛选（标签跨分类共用，带着筛选跳过去会得到空列表） */
const switchTheme = (key: ResourceTheme) => {
  activeTheme.value = key;
  activeTag.value = '';
};

/** 点标签：再点一次取消 */
const toggleTag = (tag: ResourceTag) => {
  activeTag.value = activeTag.value === tag ? '' : tag;
};

/** 清空搜索关键词（搜索框右侧叉号） */
const clearKeyword = () => {
  keyword.value = '';
};

/** 清除全部筛选条件 */
const resetFilter = () => {
  activeTag.value = '';
  keyword.value = '';
};

/**
 * 政策类型速查卡片点击。
 *
 * 按设计稿这里只要一个「简单点击事件」，不写真实详情页：
 * 实现为「按该类型标签筛选下方文件 + 轻提示」，比纯粹弹 toast 更有用，
 * 也正好对应标题行右侧的「点标签筛选相关文件」。
 */
const onCategoryTap = (c: PolicyCategory) => {
  const willFilter = activeTag.value !== c.tag;
  activeTag.value = willFilter ? c.tag : '';
  uni.showToast({
    title: willFilter ? `已按「${c.name}」筛选文件` : '已取消筛选',
    icon: 'none',
    duration: 1500,
  });
};

/** 资源卡片点击：有链接就复制，没有链接给出说明（同样不跳详情页） */
const onResourceTap = (item: CareerResource) => {
  if (item.url) {
    copyLink(item);
    return;
  }
  uni.showToast({ title: '这是平台整理的指导内容', icon: 'none', duration: 1500 });
};

const kindLabel = (kind: ResourceKind): string => RESOURCE_KIND_LABEL[kind] ?? '';

/** 复制官方链接（小程序不能直接打开外部网页） */
const copyLink = (item: CareerResource) => {
  if (!item.url) return;
  uni.setClipboardData({
    data: item.url,
    success: () => {
      uni.showToast({ title: '官方链接已复制', icon: 'none', duration: 2000 });
    },
    fail: () => {
      // 复制失败时把链接直接显示出来，保证用户仍能拿到
      uni.showModal({
        title: '复制失败',
        content: item.url as string,
        showCancel: false,
      });
    },
  });
};

// ====================== 页面加载 ======================

onLoad((options) => {
  initNavMetrics();

  // 支持从首页搜索结果带 ?focus=<id> 直接定位到某一条
  const focus = options?.focus ? decodeURIComponent(options.focus) : '';
  if (!focus) return;
  const hit = CAREER_RESOURCES.find((r) => r.id === focus);
  if (!hit) return;
  activeTheme.value = hit.theme;
  activeTag.value = '';
  keyword.value = hit.title;
});
</script>

<style scoped lang="scss">
/* ====================== 主题变量 ====================== */
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
  padding: 0 24rpx 60rpx;
  box-sizing: border-box;
}

/* ====================== 1. 顶部导航栏 ====================== */
.custom-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: #ffffff;
  border-bottom: 1rpx solid $line;
}

.nav-inner {
  display: flex;
  align-items: center;
  padding: 0 12rpx;
}

.nav-left {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
}

.nav-back {
  font-size: 56rpx;
  line-height: 1;
  color: $text-1;
  padding: 0 16rpx 8rpx;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: $text-1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.nav-right {
  height: 100%;
}

/* ====================== 2. 橙色顶部大卡片 ====================== */
.hero {
  margin-top: 24rpx;
  padding: 40rpx 32rpx 28rpx;
  border-radius: 26rpx;
  background: linear-gradient(135deg, #ff7a4d 0%, $primary 100%);
  box-shadow: 0 10rpx 30rpx rgba(255, 69, 0, 0.22);
}

.hero-title {
  display: block;
  font-size: 42rpx;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 14rpx;
}

.hero-desc {
  display: block;
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.94);
}

.hero-stats {
  display: flex;
  align-items: center;
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.32);
}

.hero-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-stat-num {
  font-size: 42rpx;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.1;
}

.hero-stat-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.88);
  margin-top: 8rpx;
}

/* ====================== 3. 分类标签横向卡片组 ====================== */
.theme-row {
  display: flex;
  margin-top: 24rpx;
  gap: 16rpx;
}

.theme-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24rpx 8rpx;
  background: #ffffff;
  border-radius: 20rpx;
  border: 2rpx solid transparent;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.05);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  /* 选中态：浅橙底 + 橙色文字 */
  &.active {
  background: #FF7239;
  border-color: #FF7239;

  // 主题图标是 #ff895d 线稿，压在 #FF7239 上几乎看不见，
  // 所以选中态给它垫一个白色圆形底（不想要可删掉这一条）
  .theme-icon-img {
    background: #ffffff;
    border-radius: 50%;
    padding: 6rpx;
  }

  .theme-label {
    color: #ffffff;
    font-weight: 700;
  }
}
}

.theme-icon-img {
  width: 56rpx;
  height: 56rpx;
  margin-bottom: 10rpx;
}

.theme-label {
  font-size: 23rpx;
  color: $text-2;
  font-weight: 500;
  text-align: center;
  line-height: 1.3;
}

/* 分类辅助说明 */
.theme-desc {
  display: block;
  font-size: 22rpx;
  color: $text-3;
  line-height: 1.6;
  padding: 16rpx 8rpx 0;
}

/* ====================== 4. 搜索框 ====================== */
.search-box {
  display: flex;
  align-items: center;
  height: 84rpx;
  margin-top: 20rpx;
  padding: 0 24rpx;
  background: #ffffff;
  border-radius: 42rpx;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.05);
}

.search-icon {
  font-size: 28rpx;
  margin-right: 14rpx;
}

/* 图片版搜索图标：小程序里 image 默认 320x240，必须显式给尺寸 */
.search-icon-img {
  width: 32rpx;
  height: 32rpx;
  flex: none;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $text-1;
}

.search-ph {
  color: $text-3;
  font-size: 26rpx;
}

.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #e5e7eb;
  margin-left: 12rpx;

  &:active {
    background: #d1d5db;
  }
}

.search-clear-icon {
  font-size: 22rpx;
  color: #6b7280;
  line-height: 1;
}

/* ====================== 通用区块 ====================== */
.section {
  margin-top: 36rpx;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 18rpx;
  padding: 0 4rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $text-1;
}

.section-hint {
  font-size: 22rpx;
  color: $text-3;
}

.section-foot {
  display: block;
  font-size: 22rpx;
  color: $text-3;
  line-height: 1.7;
  margin-top: 16rpx;
  padding: 0 4rpx;
}

/* ====================== 5. 政策类型速查卡片 ====================== */
.cat-card {
  padding: 26rpx 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  border: 2rpx solid transparent;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 16rpx;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  &.active {
    background: $primary-soft;
    border-color: $primary-light;

    .cat-name {
      color: $primary;
    }
  }

  &:active {
    background: #fafbfc;
  }
}

.cat-name {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: $text-1;
  margin-bottom: 10rpx;
}

.cat-audience {
  display: block;
  font-size: 23rpx;
  color: $primary;
  margin-bottom: 10rpx;
}

.cat-desc {
  display: block;
  font-size: 24rpx;
  color: $text-2;
  line-height: 1.7;
}

/* ====================== 筛选状态条 ====================== */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $primary-soft;
  border-radius: 14rpx;
  padding: 16rpx 24rpx;
  margin-bottom: 18rpx;
}

.filter-text {
  flex: 1;
  font-size: 23rpx;
  color: $primary;
}

.filter-reset {
  font-size: 23rpx;
  color: $text-2;
  padding-left: 20rpx;
  text-decoration: underline;
}

/* ====================== 6. 资源卡片 ====================== */
.res-card {
  padding: 28rpx 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 16rpx;
}

.res-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.res-title {
  flex: 1;
  font-size: 29rpx;
  font-weight: 600;
  color: $text-1;
  line-height: 1.5;
  padding-right: 14rpx;
}

.res-kind {
  flex-shrink: 0;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: $line;
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

.res-meta {
  display: block;
  font-size: 21rpx;
  color: $text-3;
  margin-bottom: 12rpx;
}

.res-summary {
  display: block;
  font-size: 25rpx;
  color: #374151;
  line-height: 1.75;
  margin-bottom: 14rpx;
}

.res-advice {
  background: #f8fafc;
  border-left: 6rpx solid $primary-light;
  border-radius: 10rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 14rpx;
}

.res-advice-label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: $primary;
  margin-bottom: 6rpx;
}

.res-advice-text {
  display: block;
  font-size: 23rpx;
  color: $text-2;
  line-height: 1.7;
}

.res-tags {
  display: flex;
  flex-wrap: wrap;
}

.res-tag {
  font-size: 21rpx;
  color: $text-2;
  background: $line;
  border-radius: 22rpx;
  padding: 5rpx 18rpx;
  margin: 0 12rpx 10rpx 0;

  &.active {
    background: #FF7239;
    color: #ffffff;
  }
}

.res-actions {
  margin-top: 10rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $line;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #FF7239;
  border-radius: 40rpx;
  padding: 16rpx 32rpx;

  &:active {
    opacity: 0.85;
  }
}

.copy-btn-text {
  font-size: 25rpx;
  font-weight: 600;
  color: #ffffff;
}

.copy-hint {
  display: block;
  font-size: 20rpx;
  color: $text-3;
  margin-top: 12rpx;
  line-height: 1.6;
}

/* ====================== 空状态 ====================== */
.empty-card {
  padding: 60rpx 28rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.05);
}

.empty-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-2;
  text-align: center;
  margin-bottom: 10rpx;
}

.empty-desc {
  display: block;
  font-size: 24rpx;
  color: $text-3;
  text-align: center;
  line-height: 1.7;
}

/* ====================== 7. 联动 / 免责 ====================== */
.linkage-card {
  margin-top: 36rpx;
  padding: 28rpx 24rpx;
  background: $primary-soft;
  border-radius: 20rpx;
}

.linkage-title {
  display: block;
  font-size: 29rpx;
  font-weight: 700;
  color: $text-1;
  margin-bottom: 12rpx;
}

.linkage-text {
  display: block;
  font-size: 24rpx;
  color: #7c2d12;
  line-height: 1.8;
}

.disclaimer-card {
  margin-top: 20rpx;
  padding: 28rpx 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.05);
}

.disclaimer-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: $text-2;
  margin-bottom: 14rpx;
}

.disclaimer-item {
  display: block;
  font-size: 22rpx;
  color: $text-3;
  line-height: 1.8;
  margin-bottom: 8rpx;
}
</style>
