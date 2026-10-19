<template>
  <view
    class="fav-page"
    :style="{ paddingTop: navTotalHeight + 'px' }"
  >
    <!-- 自定义导航栏：左上角返回 + 居中标题（右侧留给微信原生胶囊） -->
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
        <text class="nav-title">我的收藏</text>
        <view
          class="nav-right"
          :style="{ width: sideWidth + 'px' }"
        ></view>
      </view>
    </view>

    <view class="fav-head">
      <text class="fav-count">{{ items.length }} 条收藏</text>
    </view>

    <!-- 空状态 -->
    <view
      v-if="!items.length"
      class="fav-empty"
    >
      <text class="fav-empty-title">还没有收藏的资源</text>
      <text class="fav-empty-desc">
        去「就业政策与校招资源」，点资源卡上的 ☆ 就能收藏到这里
      </text>
      <view
        class="fav-empty-btn"
        @click="goResources"
      >
        <text>去资源页看看</text>
      </view>
    </view>

    <!-- 收藏列表 -->
    <view
      v-for="item in items"
      :key="item.title"
      class="fav-card"
    >
      <view class="fav-card-head">
        <text class="fav-card-title">{{ item.title }}</text>
        <text
          class="fav-unfav"
          @click="removeFav(item)"
        >取消收藏</text>
      </view>

      <text
        v-if="item.source"
        class="fav-card-meta"
      >
        <text v-if="item.scope">{{ item.scope }} · </text>{{ item.source }}<text v-if="item.docNo"> · {{ item.docNo }}</text>
      </text>

      <text
        v-if="item.summary"
        class="fav-card-summary"
      >{{ item.summary }}</text>

      <view class="fav-actions">
        <view
          v-if="item.url"
          class="fav-btn copy"
          @click="copyLink(item)"
        >
          <text>复制官方链接</text>
        </view>
        <view
          class="fav-btn primary"
          @click="askAi(item)"
        >
          <text>AI 提问</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 我的收藏：展示「就业政策与校招资源」里收藏过的资源。
 *
 * 收藏标题存在后端（/api/v1/employment/career-resource-favorites/），
 * 这里按标题回查本地资源库补齐来源、摘要与链接；
 * 未登录或接口失败时退回本地缓存（careerResourcesFav）。
 */
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { baseURL } from '@/utils/request';
import { CAREER_RESOURCES } from '@/utils/careerResources';

const FAV_KEY = 'careerResourcesFav';

// ====================== 顶部导航栏尺寸 ======================
const statusBarHeight = ref(20); // 状态栏高度（px）
const navBarHeight = ref(44); // 标题栏高度（px）
const sideWidth = ref(88); // 左右占位宽度（px），右侧避开微信原生胶囊
const navTotalHeight = computed(() => statusBarHeight.value + navBarHeight.value);

/** 读取状态栏与胶囊位置，任何一步失败都用默认值兜底 */
const initNavMetrics = () => {
  try {
    const win = (uni.getWindowInfo?.() ?? uni.getSystemInfoSync?.() ?? {}) as {
      statusBarHeight?: number;
      windowWidth?: number;
    };
    if (typeof win.statusBarHeight === 'number' && win.statusBarHeight > 0) {
      statusBarHeight.value = win.statusBarHeight;
    }
    // 开发者工具里 getMenuButtonBoundingClientRect 会失败并上报框架错误，直接跳过
    const device = ((uni as any).getDeviceInfo?.() ?? {}) as { platform?: string };
    if (device.platform === 'devtools') return;
    const rect = (uni as any).getMenuButtonBoundingClientRect?.();
    if (rect && rect.height > 0 && rect.top > 0) {
      navBarHeight.value = (rect.top - statusBarHeight.value) * 2 + rect.height;
      sideWidth.value = Math.max(60, (win.windowWidth ?? 375) - rect.left);
    }
  } catch {
    // 取不到就保持默认值
  }
};

/** 返回上一页；无上一页（如从分享卡片直接进入）时回首页 */
const goBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.switchTab({ url: '/pages/index/index' });
  }
};

const titles = ref<string[]>([]);

const authHeader = () => ({
  Authorization: `JWT ${uni.getStorageSync('accessToken') || ''}`,
  'Content-Type': 'application/json',
});

/** 标题 → 资源详情（资源库里找不到的收藏忽略，避免显示空壳） */
const items = computed<Record<string, any>[]>(() =>
  titles.value
    .map((t) => (CAREER_RESOURCES as Record<string, any>[]).find((r) => r.title === t))
    .filter(Boolean) as Record<string, any>[]
);

const loadFavorites = async () => {
  const cached = (uni.getStorageSync(FAV_KEY) || []) as string[];
  titles.value = cached;
  if (!uni.getStorageSync('accessToken')) return;
  try {
    const res: any = await uni.request({
      url: `${baseURL}/api/v1/employment/career-resource-favorites/`,
      method: 'GET',
      header: authHeader(),
      timeout: 8000,
    });
    const body: any = Array.isArray(res) ? res[1] : res;
    const list = body?.data?.titles;
    if (body?.statusCode === 200 && Array.isArray(list)) {
      titles.value = list.map(String);
      uni.setStorageSync(FAV_KEY, titles.value);
    }
  } catch (e) {
    console.warn('[收藏] 拉取失败，使用本地缓存', e);
  }
};

const removeFav = (item: Record<string, any>) => {
  titles.value = titles.value.filter((t) => t !== item.title);
  uni.setStorageSync(FAV_KEY, titles.value);
  uni.request({
    url: `${baseURL}/api/v1/employment/career-resource-favorites/?title=${encodeURIComponent(item.title)}`,
    method: 'DELETE',
    header: authHeader(),
    timeout: 8000,
    fail: () => console.warn('[收藏] 取消同步失败'),
  });
  uni.showToast({ title: '已取消收藏', icon: 'none', duration: 1200 });
};

const copyLink = (item: Record<string, any>) => {
  uni.setClipboardData({
    data: String(item.url || ''),
    success: () => uni.showToast({ title: '链接已复制，请到浏览器打开', icon: 'none', duration: 2000 }),
  });
};

const askAi = (item: Record<string, any>) => {
  uni.setStorageSync('aiPendingPrompt', `基于《${item.title}》，帮我解答：`);
  uni.switchTab({ url: '/pages/ai/ai' });
};

const goResources = () => {
  uni.navigateTo({ url: '/pagesMember/careerResources/careerResources' });
};

onLoad(() => {
  initNavMetrics();
  loadFavorites();
});
</script>

<style scoped lang="scss">
.fav-page {
  min-height: 100vh;
  padding: 0 24rpx 60rpx;
  background: #f5f6f8;
  box-sizing: border-box;
}

/* ====================== 顶部导航栏 ====================== */
.custom-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: #ffffff;
  border-bottom: 1rpx solid #eef0f3;
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
  color: #1f2937;
  padding: 0 16rpx 8rpx;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.nav-right {
  height: 100%;
}

.fav-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 16rpx 0 20rpx;
}

.fav-count {
  font-size: 24rpx;
  color: #94a3b8;
}

.fav-empty {
  margin-top: 120rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.fav-empty-title {
  font-size: 30rpx;
  color: #475569;
}

.fav-empty-desc {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #94a3b8;
  text-align: center;
  line-height: 1.6;
  padding: 0 40rpx;
}

.fav-empty-btn {
  margin-top: 32rpx;
  padding: 16rpx 40rpx;
  border-radius: 999rpx;
  background: #ff7239;
  color: #ffffff;
  font-size: 26rpx;
}

.fav-card {
  padding: 26rpx 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
}

.fav-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.fav-card-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.5;
}

.fav-unfav {
  flex: none;
  margin-left: 16rpx;
  font-size: 22rpx;
  color: #94a3b8;
}

.fav-card-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

.fav-card-summary {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #4b5563;
}

.fav-actions {
  display: flex;
  align-items: center;
  margin-top: 18rpx;
}

.fav-btn {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  margin-right: 14rpx;
}

.fav-btn.copy {
  color: #ff7239;
  background: #fff3ed;
  border: 1rpx solid #fde3d3;
}

.fav-btn.primary {
  color: #ffffff;
  background: #2563eb;
}
</style>
