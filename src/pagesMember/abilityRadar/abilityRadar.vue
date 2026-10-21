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

      实现方式：原生 canvas 2d 手绘（不依赖 ECharts）。
      整张图只有「十维多边形 + 十个顶点星球」，手绘逻辑见 lib/radarCanvas.ts。
    -->
    <view class="canvas-wrap">
      <canvas
        id="radarCanvas"
        type="2d"
        class="radar-canvas"
        @touchstart="onCanvasTouch"
      />
      <!-- 点击星球后的浮层：维度｜分数 / 等级 / 一句话描述 -->
      <view
        v-if="tip"
        class="radar-tip"
        :style="{ left: tip.left + 'px', top: tip.top + 'px' }"
        @touchstart.stop="clearTip"
      >
        <text class="tip-title">{{ tip.label }}｜{{ tip.score }}分</text>
        <text class="tip-grade">【{{ tip.grade }}】</text>
        <text class="tip-desc">{{ tip.desc }}</text>
      </view>
    </view>

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
import { computed, getCurrentInstance, nextTick, ref } from 'vue';
import { onLoad, onReady } from '@dcloudio/uni-app';
import { STUDENT_PROFILE_STORAGE_KEY, type StudentProfile } from '@/types/studentProfile';
import {
  drawRadar,
  hitTest,
  scoreToDesc,
  scoreToGrade,
  type RadarDimensionInput,
  type RadarGeometry,
} from './lib/radarCanvas';

/**
 * 能力星球图（全屏版）
 *
 * 历史：本页原来用 ECharts（按需打包 + terser 压缩后约 470KB）绘制。
 * 整张图只有「十维雷达骨架 + 十个顶点星球」两种图形，用 ECharts 属于大材小用，
 * 还会触发开发者工具「静态资源超过 200KB」告警。
 * 现已改为原生 canvas 2d 手绘（lib/radarCanvas.ts），并与「能力画像」页内联的纯 CSS 版
 * 保持同一套视觉口径：4 层同心圆网格（#eeeeee）、0.08 橘色多边形填充、2px 橘色轮廓、
 * 30~52rpx 三档渐变球体（≥80 暖橘 / 70~79 浅橙黄 / <70 浅灰）、24rpx 维度标签。
 * 无发光、点击查看得分与等级。
 */
const profile = ref<StudentProfile | null>(null);

/** 点击星球后的浮层数据；null 表示不显示 */
const tip = ref<{
  left: number;
  top: number;
  label: string;
  score: number;
  grade: string;
  desc: string;
} | null>(null);

const instance = getCurrentInstance();
let ctx: CanvasRenderingContext2D | null = null;
/** canvas 的 CSS 尺寸（px），与 ctx 内部的 CSS px 坐标系一致 */
let canvasW = 0;
let canvasH = 0;
/** 1rpx 对应的 CSS px（windowWidth / 750），用于和内联版的气泡/标签尺寸对齐 */
let rpxPx = 0.5;
/** 画布在视口中的位置（px），触摸坐标换算兜底用 */
let canvasLeft = 0;
let canvasTop = 0;
/** 绘制时算出的星球坐标，触摸时用于命中检测 */
let geometry: RadarGeometry | null = null;

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

/** 传给绘制引擎的十维数据（顺序无所谓，内部按 key 重排） */
const dimensions = computed<RadarDimensionInput[]>(() =>
  (profile.value?.dimensions ?? []).map((d) => ({
    key: d.key,
    label: d.label,
    score: d.score,
  }))
);

const hasProfile = computed(() => dimensions.value.length > 0);

onReady(() => {
  nextTick(initCanvas);
});

/** 取 canvas 节点，按设备像素比缩放后首绘 */
const initCanvas = () => {
  const query = uni.createSelectorQuery().in(instance?.proxy as any);
  query
    .select('#radarCanvas')
    .fields({ node: true, size: true, rect: true })
    .exec((res: any[]) => {
      const item = res?.[0];
      if (!item || !item.node) {
        console.warn('[能力星球] 未取到 canvas 节点，图表未渲染');
        return;
      }
      const node = item.node as any;
      const win = (uni.getWindowInfo?.() ?? uni.getSystemInfoSync?.() ?? {}) as {
        pixelRatio?: number;
        windowWidth?: number;
      };
      const dpr = typeof win.pixelRatio === 'number' && win.pixelRatio > 0 ? win.pixelRatio : 2;
      // 750rpx = 窗口宽度，换成 CSS px 后气泡/标签才能和内联版同尺寸
      rpxPx = (typeof win.windowWidth === 'number' && win.windowWidth > 0 ? win.windowWidth : 375) / 750;

      canvasW = item.width;
      canvasH = item.height;
      // 画布在视口中的位置：部分基础库的 touch 事件只给 clientX/clientY，
      // 需要减去画布位置才能换算成画布内坐标，这里一并取回做兜底。
      canvasLeft = typeof item.left === 'number' ? item.left : 0;
      canvasTop = typeof item.top === 'number' ? item.top : 0;
      node.width = Math.floor(canvasW * dpr);
      node.height = Math.floor(canvasH * dpr);

      const context = node.getContext('2d') as CanvasRenderingContext2D;
      // 按 dpr 缩放后，绘制代码统一用 CSS px
      context.scale(dpr, dpr);
      ctx = context;
      redraw();
    });
};

/** 按当前画像重绘整张图（画像为空时画一张全 0 的空多边形） */
const redraw = () => {
  if (!ctx) return;
  geometry = drawRadar(ctx, dimensions.value, canvasW, canvasH, rpxPx);
};

/**
 * 触摸命中：canvas 无法给图形单独挂事件，这里用「最近星球 + 容差」判定。
 * 命中则弹出浮层；触摸空白处收起浮层。
 */
const onCanvasTouch = (e: any) => {
  const touch = e?.touches?.[0] ?? e?.changedTouches?.[0];
  if (!touch) return;

  // 优先用小程序给出的相对画布坐标；拿不到时用 clientX/Y 减去画布位置换算
  const x =
    typeof touch.x === 'number'
      ? touch.x
      : typeof touch.clientX === 'number'
        ? touch.clientX - canvasLeft
        : NaN;
  const y =
    typeof touch.y === 'number'
      ? touch.y
      : typeof touch.clientY === 'number'
        ? touch.clientY - canvasTop
        : NaN;
  if (Number.isNaN(x) || Number.isNaN(y)) return;

  const hit = hitTest(geometry, x, y);
  if (!hit) {
    tip.value = null;
    return;
  }

  // 浮层水平居中在星球上方，并贴边裁剪，避免超出画布
  const halfWidth = 120;
  const left = Math.min(
    Math.max(hit.x, halfWidth),
    Math.max(canvasW - halfWidth, halfWidth)
  );

  tip.value = {
    left,
    top: hit.y - 8,
    label: hit.label,
    score: hit.score,
    grade: scoreToGrade(hit.score),
    desc: scoreToDesc(hit.label, hit.score),
  };
};

const clearTip = () => {
  tip.value = null;
};

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

/* 画布容器：浮层相对它定位 */
.canvas-wrap {
  position: relative;
  width: 100%;
}

.radar-canvas {
  display: block;
  width: 100%;
  height: 700rpx;
}

/* 点击星球后的浮层卡片 */
.radar-tip {
  position: absolute;
  z-index: 10;
  min-width: 260rpx;
  max-width: 560rpx;
  padding: 16rpx 24rpx;
  background: #fff7f2;
  border: 1rpx solid #ff9771;
  border-radius: 16rpx;
  box-shadow: 0 6rpx 20rpx rgba(255, 129, 76, 0.16);
  transform: translate(-50%, -100%);
  pointer-events: none;
}

.tip-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #333333;
}

.tip-grade {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #ff7239;
}

.tip-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: #666666;
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
  background: linear-gradient(135deg, #ff8a54 0%, #ff7239 100%);
  border-radius: 38rpx;
  border: none;
}
</style>
