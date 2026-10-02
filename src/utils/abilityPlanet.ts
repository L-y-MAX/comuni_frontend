/**
 * 能力星球图 —— 布局计算（纯函数，无 DOM / 无 canvas 依赖）
 *
 * ## 设计：雷达图骨架 + 顶点气泡
 *
 * 计划书「可视化创新」要求摒弃传统雷达图、用**能力星球图**展示十维能力。
 * 但纯散点气泡有两个问题：维度之间的对比关系看不出来，评委一眼读不懂；
 * 十项挨在一起也容易显得拥挤。
 *
 * 所以最终方案是「雷达骨架 + 顶点气泡」：
 *   - 底层画标准十维雷达（分割圈 + 坐标轴 + 极淡填充 + 轮廓折线），
 *     保留雷达图「维度对比一眼看懂」的优势；
 *   - 每根轴的**分值位置**上放一颗气泡，直径也由分值决定，
 *     保留「能力星球」这个项目特有的创意表达；
 *   - 雷达只做衬托（浅灰线 + 0.08 透明度填充），视觉焦点全在气泡上。
 *
 * ## 为什么用 CSS 定位而不是 canvas
 *
 * 小程序里 canvas 需要 `createSelectorQuery().fields({node:true})` 取节点、
 * 处理 DPR 缩放，且在自定义组件、分包、真机上的兼容性坑较多。
 * 而本图只需「圆按极坐标摆放 + 线段按角度旋转」，用绝对定位 + rotate 完全够用：
 *   1. 布局数学可以抽成纯函数，脱离渲染环境做单元测试（见自检脚本）；
 *   2. 不依赖 canvas 版本差异，真机表现一致；
 *   3. 轮廓折线逐边绘制，角度精确，不依赖 clip-path 支持。
 *
 * ## ⚠️ 坐标系约定（改这里之前务必读）
 *
 * 返回的所有 Percent 都是**百分比**，渲染侧必须放在**正方形**容器里
 * （abilityProfile.vue 用 `padding-bottom:100%` 撑正方形）。
 * 只有在正方形里，「同一个半径百分比」才等于「同一个像素半径」，
 * 雷达与圆环才不会被拉扁成椭圆。
 *
 * 角度约定：0 度指向右侧（与 CSS `rotate(0deg)` 一致），
 * 第一个维度从 12 点方向开始（即 -90 度），顺时针排列。
 */

import type { AbilityDimensionKey, AbilityLevel } from '@/types/jobProfile';

// ====================== 雷达骨架 ======================

/** 雷达外圈半径（占容器边长的百分比） */
export const RADAR_RADIUS_PERCENT = 30;

/**
 * 维度标签所在半径（占容器边长的百分比）
 *
 * 必须明显大于雷达外圈半径：需求明确要求「十个维度文字标签全部放到雷达外圈
 * 外部，不要挤在图内部」。两者相差 10% ≈ 63rpx，正好容纳四字标签。
 */
export const LABEL_RADIUS_PERCENT = 40;

/** 分割圈：按雷达半径的比例画同心圆（只做参考，视觉最弱） */
export const GRID_RING_RATIOS = [0.25, 0.5, 0.75, 1] as const;

// ====================== 气泡 ======================

/**
 * 分值 → 顶点半径的映射区间（相对雷达半径）
 *
 * 不直接映射到 0~1：下限留 0.3 让低分气泡不至于挤在圆心，
 * 上限留 0.86 让满分气泡不会压到外圈外侧的维度标签。
 */
export const SCORE_RADIUS_MIN_RATIO = 0.3;
export const SCORE_RADIUS_MAX_RATIO = 0.86;

/**
 * 气泡直径区间（rpx）
 *
 * 上限是硬约束：需求点名禁止气泡过大导致相邻气泡碰撞，
 * 这里封顶 52rpx，配合 36° 的角距，任意两颗之间至少留 40rpx 空隙。
 */
export const BUBBLE_SIZE_MIN = 30;
export const BUBBLE_SIZE_MAX = 52;

/**
 * 分值 → 视觉档位
 *
 * 只决定气泡配色，和「用直径表达分值」这条主轴无关。
 * 三档按需求给定：≥80 暖橘 / 70~79 浅橙黄 / <70 浅灰。
 */
export type PlanetTier = 'high' | 'mid' | 'low';

export const scoreToTier = (score: number): PlanetTier => {
  if (score >= 80) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
};

// ====================== 类型 ======================

export interface RadarNodeInput {
  key: AbilityDimensionKey;
  label: string;
  score: number;
  level: AbilityLevel;
}

/** 一根轴：维度标签位置 + 轴线绘制参数 */
export interface RadarAxis {
  key: AbilityDimensionKey;
  label: string;
  score: number;
  level: AbilityLevel;
  /** 轴方向角（度），0 度为右侧，-90 度为 12 点方向 */
  angleDeg: number;
  /** 维度标签中心位置（占容器边长百分比） */
  labelXPercent: number;
  labelYPercent: number;
  /** 轴线：从圆心到外圈的一段线，用 rotate 绘制 */
  lineMidXPercent: number;
  lineMidYPercent: number;
  lineLengthPercent: number;
  lineAngleDeg: number;
}

/** 一颗顶点气泡 */
export interface RadarBubble extends RadarNodeInput {
  tier: PlanetTier;
  /** 气泡中心（占容器边长百分比） */
  xPercent: number;
  yPercent: number;
  /** 该顶点到圆心的距离（占容器边长百分比） */
  radiusPercent: number;
  /** 该顶点半径占雷达半径的比例（0~1，便于断言） */
  radiusRatio: number;
  /** 气泡直径（rpx） */
  sizeRpx: number;
  angleDeg: number;
  index: number;
}

/** 轮廓折线的一条边（用一条旋转的细线绘制，角度精确，不依赖 clip-path） */
export interface RadarEdge {
  midXPercent: number;
  midYPercent: number;
  lengthPercent: number;
  angleDeg: number;
}

export interface RadarLayout {
  axes: RadarAxis[];
  bubbles: RadarBubble[];
  edges: RadarEdge[];
  /** 供 `clip-path: polygon(...)` 使用的顶点串 */
  polygonPoints: string;
  /** 分割圈半径（占容器边长百分比） */
  gridRings: number[];
  /** 雷达外圈半径（占容器边长百分比） */
  radiusPercent: number;
  /** 维度标签半径（占容器边长百分比） */
  labelRadiusPercent: number;
}

// ====================== 计算 ======================

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round2 = (v: number) => Number(v.toFixed(2));

/**
 * 分值 → 顶点半径比例（相对雷达半径）
 *
 * 结果统一保留 4 位小数：不做的话 0.3 + 0.56 会算出 0.8600000000000001，
 * 端点值对不上常量，后续断言与阈值比较都会莫名其妙地失败。
 */
export const scoreToRadiusRatio = (score: number): number => {
  const r = clamp01(score / 100);
  return Number(
    (SCORE_RADIUS_MIN_RATIO + (SCORE_RADIUS_MAX_RATIO - SCORE_RADIUS_MIN_RATIO) * r).toFixed(4)
  );
};

/** 分值 → 气泡直径（rpx） */
export const scoreToBubbleSize = (score: number): number => {
  const r = clamp01(score / 100);
  return Math.round(BUBBLE_SIZE_MIN + (BUBBLE_SIZE_MAX - BUBBLE_SIZE_MIN) * r);
};

/**
 * 生成「雷达骨架 + 顶点气泡」布局。
 *
 * @param dimensions 十个维度（顺序即轴的顺序，建议按 JOB_DIMENSIONS 顺序传入）
 */
export const buildRadarLayout = (dimensions: RadarNodeInput[]): RadarLayout => {
  const total = dimensions.length || 1;

  const axes: RadarAxis[] = [];
  const bubbles: RadarBubble[] = [];

  dimensions.forEach((dim, index) => {
    const angleDeg = round2((360 / total) * index - 90);
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // 维度标签：固定摆在雷达外圈之外的同心圆上
    axes.push({
      ...dim,
      angleDeg,
      labelXPercent: round2(50 + LABEL_RADIUS_PERCENT * cos),
      labelYPercent: round2(50 + LABEL_RADIUS_PERCENT * sin),
      // 轴线：从圆心到外圈，取中点做 rotate 定位
      lineMidXPercent: round2(50 + (RADAR_RADIUS_PERCENT / 2) * cos),
      lineMidYPercent: round2(50 + (RADAR_RADIUS_PERCENT / 2) * sin),
      lineLengthPercent: RADAR_RADIUS_PERCENT,
      lineAngleDeg: angleDeg,
    });

    const radiusRatio = scoreToRadiusRatio(dim.score);
    const radiusPercent = RADAR_RADIUS_PERCENT * radiusRatio;

    bubbles.push({
      ...dim,
      tier: scoreToTier(dim.score),
      angleDeg,
      xPercent: round2(50 + radiusPercent * cos),
      yPercent: round2(50 + radiusPercent * sin),
      radiusPercent: round2(radiusPercent),
      radiusRatio: Number(radiusRatio.toFixed(4)),
      sizeRpx: scoreToBubbleSize(dim.score),
      index,
    });
  });

  // 轮廓折线：把相邻两个顶点连成一条旋转细线（含首尾闭合）
  const edges: RadarEdge[] = bubbles.map((b, i) => {
    const next = bubbles[(i + 1) % bubbles.length];
    const dx = next.xPercent - b.xPercent;
    const dy = next.yPercent - b.yPercent;
    return {
      midXPercent: round2((b.xPercent + next.xPercent) / 2),
      midYPercent: round2((b.yPercent + next.yPercent) / 2),
      lengthPercent: round2(Math.hypot(dx, dy)),
      angleDeg: round2((Math.atan2(dy, dx) * 180) / Math.PI),
    };
  });

  return {
    axes,
    bubbles,
    edges,
    polygonPoints: bubbles.map((b) => `${b.xPercent}% ${b.yPercent}%`).join(', '),
    gridRings: GRID_RING_RATIOS.map((r) => round2(RADAR_RADIUS_PERCENT * r)),
    radiusPercent: RADAR_RADIUS_PERCENT,
    labelRadiusPercent: LABEL_RADIUS_PERCENT,
  };
};

/** 校验布局是否都落在容器内（供自检使用，避免圆点/标签被裁掉） */
export const isRadarInsideBounds = (layout: RadarLayout, padding = 1): boolean => {
  const within = (v: number) => v >= padding && v <= 100 - padding;
  return (
    layout.bubbles.every((b) => within(b.xPercent) && within(b.yPercent)) &&
    layout.axes.every((a) => within(a.labelXPercent) && within(a.labelYPercent))
  );
};
