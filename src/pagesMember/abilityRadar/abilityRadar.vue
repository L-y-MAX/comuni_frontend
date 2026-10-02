<template>
  <view class="radar-page">
    <!-- 顶部说明 -->
    <view class="radar-head">
      <text class="radar-title">能力星球图</text>
      <text class="radar-sub">雷达为骨架，顶点星球越大 = 该项能力越强</text>
    </view>

    <!--
      图表本体：整页只放这一张图，**不套 scroll-view**。
      原因：微信的 canvas 是原生组件，放在 scroll-view 里不会跟着内容滚动，
      会出现「滑动页面图表固定不动」的现象，所以这里单独开一个分包页承载它。
    -->
    <UniEcharts
      custom-style="width: 100%; height: 700rpx;"
      canvas-type="2d"
    />

    <!-- 配色图例：和星球的三档配色一一对应 -->
    <view class="radar-legend">
      <view class="legend-item">
        <view class="legend-dot tier-high" />
        <text class="legend-text">≥80 分</text>
      </view>
      <view class="legend-item">
        <view class="legend-dot tier-mid" />
        <text class="legend-text">70~79 分</text>
      </view>
      <view class="legend-item">
        <view class="legend-dot tier-low" />
        <text class="legend-text">低于 70 分</text>
      </view>
    </view>

    <view class="radar-hint">
      <text class="hint-text">点击任意星球，可以查看该项的得分、等级与说明</text>
    </view>

    <!-- 没有画像数据时的引导（此时十个维度都是 0，图会是一个空多边形） -->
    <view
      v-if="!hasProfile"
      class="radar-empty"
    >
      <text class="empty-text">还没有生成能力画像，先去「能力画像」页生成一份吧</text>
      <button
        class="empty-btn"
        @tap="goProfile"
      >
        去生成能力画像
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import UniEcharts from 'uni-echarts';
import { provideEcharts, provideEchartsOption } from 'uni-echarts/shared';
import echarts from './lib/echartsSetup';
import { buildAbilityRadarOption, type RadarDimensionInput } from './lib/radarOption';
import { STUDENT_PROFILE_STORAGE_KEY, type StudentProfile } from '@/types/studentProfile';

/**
 * 能力星球图（全屏版）
 *
 * 为什么单独做一个分包页，而不是直接嵌在能力画像页里：
 *   1. canvas 是原生组件，放进 scroll-view 会「固定不动」，整页只放图表最稳；
 *   2. ECharts 按需打包后仍有约 500KB，能力画像页在主包里，
 *      嵌进去会把主包从 0.49MB 顶到 0.97MB；放进分包后主包不受影响，
 *      只有真正点进来时才下载这一份代码。
 */
const profile = ref<StudentProfile | null>(null);

onLoad(() => {
  // 画像由能力画像页生成后存在本地缓存里，这里直接读，无需再请求接口
  try {
    const raw = uni.getStorageSync(STUDENT_PROFILE_STORAGE_KEY);
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && Array.isArray(parsed.dimensions)) {
      profile.value = parsed as StudentProfile;
    }
  } catch (e) {
    console.warn('读取能力画像失败：', e);
  }
});

/** 传给 option 构造器的十维数据（顺序无所谓，构造器内部按 key 重排） */
const dimensions = computed<RadarDimensionInput[]>(() =>
  (profile.value?.dimensions ?? []).map((d) => ({
    key: d.key,
    label: d.label,
    score: d.score,
  }))
);

const hasProfile = computed(() => dimensions.value.length > 0);

/** ECharts option；画像后到（onLoad 之后才读到）时会自动重算并刷新图表 */
const radarOption = computed(() => buildAbilityRadarOption(dimensions.value));

// uni-echarts 通过 provide/inject 拿 echarts 与 option：
// ⚠️ option 必须走注入，不能写成 <UniEcharts :option="..."> ——
//    小程序端组件 props 会被 setData 序列化，option 里的函数
//    （symbolSize 缩放、tooltip.formatter 文案）会全部丢失。
provideEcharts(echarts);
provideEchartsOption(radarOption);

const goProfile = () => {
  uni.switchTab({ url: '/pages/abilityProfile/abilityProfile' });
};
</script>

<style scoped lang="scss">
.radar-page {
  min-height: 100vh;
  background: #fdfdfd;
  padding: 24rpx 20rpx 40rpx;
  box-sizing: border-box;
}

.radar-head {
  margin-bottom: 16rpx;
}

.radar-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #333333;
}

.radar-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #888888;
}

/* 图例：与星球三档配色一致 */
.radar-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32rpx;
  margin-top: 8rpx;
}

.legend-item {
  display: flex;
  align-items: center;
}

.legend-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  margin-right: 8rpx;
}

.legend-dot.tier-high {
  background: radial-gradient(circle at 50% 50%, #ff9771 0%, #ffd9c7 100%);
  border: 1rpx solid #e8703f;
}

.legend-dot.tier-mid {
  background: radial-gradient(circle at 50% 50%, #ffb347 0%, #ffd291 100%);
  border: 1rpx solid #dfa030;
}

.legend-dot.tier-low {
  background: radial-gradient(circle at 50% 50%, #e2e2e2 0%, #f1f1f1 100%);
  border: 1rpx solid #b9bfc9;
}

.legend-text {
  font-size: 22rpx;
  color: #666666;
}

.radar-hint {
  margin-top: 20rpx;
  text-align: center;
}

.hint-text {
  font-size: 22rpx;
  color: #999999;
}

.radar-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  background: #ffffff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(17, 24, 39, 0.04);
}

.empty-text {
  display: block;
  font-size: 26rpx;
  line-height: 1.6;
  color: #666666;
}

.empty-btn {
  margin-top: 20rpx;
  height: 76rpx;
  line-height: 76rpx;
  font-size: 28rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #ff4500 0%, #ff6733 100%);
  border-radius: 38rpx;
  border: none;
}
</style>
