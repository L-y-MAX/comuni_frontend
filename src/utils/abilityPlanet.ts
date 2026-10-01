/**
 * 能力星球图 —— 布局计算（纯函数，无 DOM / 无 canvas 依赖）
 *
 * 计划书「可视化创新」要求：摒弃传统雷达图，用**能力星球图**
 * （以星球大小、亮度体现能力分值）展示学生十维能力。
 *
 * ## 为什么用 CSS 定位而不是 canvas
 *
 * 小程序里 canvas 需要 `createSelectorQuery().fields({node:true})` 取节点、
 * 处理 DPR 缩放，且在自定义组件、分包、真机上的兼容性坑较多。
 * 而本图只需「圆形元素按极坐标摆放 + 大小/亮度映射」，
 * 用绝对定位 + radial-gradient 完全能实现同样的视觉效果，并且：
 *   1. 可以用 CSS transition / keyframes 直接做呼吸、旋转动画；
 *   2. 不依赖 canvas 版本差异，真机表现一致；
 *   3. 布局数学可以抽成纯函数，脱离渲染环境做单元测试（见下方自检）。
 *
 * 因此这里只负责算数，渲染交给 abilityProfile.vue 的 WXML/WXSS。
 */

import type { AbilityDimensionKey, AbilityLevel } from '@/types/jobProfile';

// ====================== 映射区间 ======================

/** 星球直径区间（rpx） */
export const PLANET_SIZE_MIN = 46;
export const PLANET_SIZE_MAX = 104;

/** 星球亮度区间（0-1，用于 opacity 与光晕强度） */
export const PLANET_BRIGHTNESS_MIN = 0.42;
export const PLANET_BRIGHTNESS_MAX = 1;

/** 内圈 / 外圈轨道半径（相对容器的百分比，取宽高各自的百分比） */
export const ORBIT_RADIUS_INNER = 28;
export const ORBIT_RADIUS_OUTER = 39;

/** 主星球（核心）直径（rpx） */
export const CORE_SIZE = 176;

// ====================== 类型 ======================

export interface PlanetNodeInput {
  key: AbilityDimensionKey;
  label: string;
  score: number;
  level: AbilityLevel;
}

export interface PlanetNode extends PlanetNodeInput {
  /** 横向位置百分比（0-100），直接给 CSS left 用，已按星球半径做了内缩修正 */
  xPercent: number;
  /** 纵向位置百分比（0-100），给 CSS top 用 */
  yPercent: number;
  /** 星球直径（rpx） */
  sizeRpx: number;
  /** 亮度 0-1 */
  brightness: number;
  /** 所在轨道半径百分比 */
  orbitRadiusPercent: number;
  /** 极角（度），0 度为 12 点方向，顺时针递增 */
  angleDeg: number;
  /** 序号（0 起），用于错开动画延迟 */
  index: number;
}

export interface PlanetLayout {
  nodes: PlanetNode[];
  /** 需要绘制的轨道环半径（去重后） */
  rings: number[];
  /** 主星球直径 */
  coreSizeRpx: number;
}

// ====================== 计算 ======================

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 分值 → 星球直径（rpx） */
export const scoreToPlanetSize = (score: number): number => {
  const ratio = clamp01(score / 100);
  return Math.round(PLANET_SIZE_MIN + (PLANET_SIZE_MAX - PLANET_SIZE_MIN) * ratio);
};

/** 分值 → 亮度（0-1） */
export const scoreToBrightness = (score: number): number => {
  const ratio = clamp01(score / 100);
  return Number((PLANET_BRIGHTNESS_MIN + (PLANET_BRIGHTNESS_MAX - PLANET_BRIGHTNESS_MIN) * ratio).toFixed(3));
};

/**
 * 生成能力星球图布局。
 *
 * 规则：
 * - 十个星球均匀分布（每 36°），从 12 点方向起顺时针排列；
 * - 奇偶交替落在内圈/外圈，形成前后层次，同时保证同圈相邻星球间隔 72°，避免重叠；
 * - 星球直径与亮度由分值映射（分值越高，越大越亮）。
 *
 * @param dimensions 十个维度（顺序即摆放顺序，建议按 JOB_DIMENSIONS 顺序传入）
 */
export const buildPlanetLayout = (dimensions: PlanetNodeInput[]): PlanetLayout => {
  const total = dimensions.length || 1;

  const nodes: PlanetNode[] = dimensions.map((dim, index) => {
    const angleDeg = (360 / total) * index - 90; // -90 让第一个落在 12 点方向
    const rad = (angleDeg * Math.PI) / 180;
    const orbitRadiusPercent = index % 2 === 0 ? ORBIT_RADIUS_INNER : ORBIT_RADIUS_OUTER;

    const sizeRpx = scoreToPlanetSize(dim.score);
    const brightness = scoreToBrightness(dim.score);

    // 极坐标 → 百分比坐标。
    // 半径按容器宽高的百分比计算，因此在不同屏幕上会呈轻微椭圆分布，观感更自然。
    const xPercent = Number((50 + orbitRadiusPercent * Math.cos(rad)).toFixed(2));
    const yPercent = Number((50 + orbitRadiusPercent * Math.sin(rad)).toFixed(2));

    return {
      ...dim,
      xPercent,
      yPercent,
      sizeRpx,
      brightness,
      orbitRadiusPercent,
      angleDeg: Number(angleDeg.toFixed(2)),
      index,
    };
  });

  return {
    nodes,
    rings: Array.from(new Set(nodes.map((n) => n.orbitRadiusPercent))).sort((a, b) => a - b),
    coreSizeRpx: CORE_SIZE,
  };
};

/**
 * 校验布局是否可用：所有星球都必须落在容器可视范围内。
 * 供自检使用，避免星球被裁掉。
 */
export const isLayoutInsideBounds = (layout: PlanetLayout, padding = 2): boolean =>
  layout.nodes.every(
    (n) =>
      n.xPercent >= padding &&
      n.xPercent <= 100 - padding &&
      n.yPercent >= padding &&
      n.yPercent <= 100 - padding
  );
