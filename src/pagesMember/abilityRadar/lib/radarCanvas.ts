/**
 * 能力星球图 —— 原生 Canvas 2D 自绘引擎（替代 ECharts）
 *
 * ## 为什么不用 ECharts
 *
 * 整张图只有两种图形：「十维雷达骨架」与「十个顶点星球」。
 * ECharts 即使按需打包（radar + scatter + polar + canvas 渲染器）并经 terser 压缩，
 * 产物仍有约 470KB，占整个分包近一半体积，还会触发开发者工具「静态资源超过 200KB」告警。
 * 用小程序原生 canvas 2d 手绘，逻辑只有百来行、体积可忽略，并且渲染行为完全可控。
 *
 * ## 视觉口径：与「能力画像」页内联的纯 CSS 雷达图完全一致
 *
 *   容器：正方形（内联版用 padding-bottom:100% 撑方），雷达半径 = 边长 × 30%
 *   网格：4 层同心圆（#eeeeee、1px），半径比例 0.25 / 0.5 / 0.75 / 1
 *   轴线：圆心到外圈的浅灰细线
 *   填充：数据多边形，rgba(255,151,113,0.08)
 *   轮廓：数据多边形折线，#ff9771、2px、opacity 0.85
 *   星球：直径 30~52rpx（随分值线性增加），三档径向渐变（≥80 暖橘 / 70~79 浅橙黄 / <70 浅灰），无描边、无发光
 *   标签：维度中文名放在边长 40% 的同心圆上，24rpx、#333
 *
 * ## 交互
 *
 *   canvas 不能像 DOM 一样挂点击事件到图形上，所以采用「触摸命中检测」：
 *   记录每颗星球在画布上的坐标，触摸时找最近的一颗（星球半径 + 8px 容差），
 *   命中则由页面弹出一张浮层卡片展示「维度｜分数 / 等级 / 一句话描述」。
 */

import type { AbilityDimensionKey } from '@/types/jobProfile';

// ====================== 视觉常量（与非全屏纯 CSS 版保持一致） ======================

/** 网格/轴线颜色（内联版 .radar-ring / .radar-axis 的 #eeeeee） */
export const LINE_COLOR = '#eeeeee';
export const PRIMARY_COLOR = '#ff9771';
/** 多边形填充（内联版 .radar-fill 的 rgba(255,151,113,0.08)） */
export const AREA_COLOR = 'rgba(255, 151, 113, 0.08)';
/** 网格/轴线宽（canvas 用 1px） */
const GRID_LINE_WIDTH = 1;
/** 轮廓线宽与透明度（内联版 .radar-edge：2rpx、opacity .85） */
const OUTLINE_LINE_WIDTH = 2;
const OUTLINE_ALPHA = 0.85;
/** 雷达外圈半径占「正方形边长」的比例（内联版 RADAR_RADIUS_PERCENT = 30） */
const RADIUS_PERCENT = 0.3;
/** 维度标签半径占正方形边长的比例（内联版 LABEL_RADIUS_PERCENT = 40） */
const LABEL_RADIUS_PERCENT = 0.4;
/** 网格层数（内联版 GRID_RING_RATIOS：0.25 / 0.5 / 0.75 / 1） */
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];
/** 维度标签字号（内联版 24rpx） */
const LABEL_FONT_RPX = 24;
/** 取不到窗口宽度时的兜底（常见设计稿宽 375px） */
const FALLBACK_RPX_PX = 0.5;

/** 三档球体渐变：半径由分值决定，颜色只分三档（内联版 .bubble.tier-*） */
export const PLANET_GRADIENTS = {
  /** 分值 ≥ 80：暖橘 */
  high: ['#ff9771', '#ffd9c7'],
  /** 70 ≤ 分值 < 80：浅橙黄 */
  mid: ['#ffb347', '#ffe4c2'],
  /** 分值 < 70：浅灰 */
  low: ['#e2e2e2', '#f4f4f4'],
} as const;

/** 球体直径区间（rpx，内联版 BUBBLE_SIZE_MIN/MAX = 30 / 52） */
const BUBBLE_SIZE_MIN_RPX = 30;
const BUBBLE_SIZE_MAX_RPX = 52;

/** 触摸命中容差（px），在球体半径基础上额外放宽，方便手指点中 */
const HIT_TOLERANCE_EXTRA = 8;

/**
 * 十个维度的展示顺序。
 *
 * 用项目里真实存在的 key（见 types/jobProfile.ts 的 JOB_DIMENSIONS）。
 * 取分时按 key 匹配而不是按数组下标，后端返回顺序变了也不会串位。
 */
export const DIMENSION_ORDER: AbilityDimensionKey[] = [
  'professional_skill',
  'certificate',
  'internship',
  'teamwork',
  'communication',
  'stress_resistance',
  'innovation',
  'logical_thinking',
  'industry_cognition',
  'learning',
];

// ====================== 取值辅助 ======================

export interface RadarDimensionInput {
  key: AbilityDimensionKey;
  /** 维度中文名（用画像里的 label，保证和「十维明细」用词一致） */
  label: string;
  /** 0~100 */
  score: number;
}

export type PlanetTier = keyof typeof PLANET_GRADIENTS;

/** 分值 → 档位（决定配色） */
export const scoreToTier = (score: number): PlanetTier => {
  if (score >= 80) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
};

/**
 * 分值 → 顶点半径比例（0~1，相对雷达半径）
 *
 * 与内联版一致：下限 0.3（低分球不至于挤在圆心）、上限 0.86（满分球不会压到标签）。
 */
export const scoreToRadiusRatio = (score: number): number => {
  const r = Math.max(0, Math.min(1, score / 100));
  return 0.3 + 0.56 * r;
};

/** 分值 → 球体直径（rpx）：30~52rpx 线性映射 */
export const scoreToBubbleSizeRpx = (score: number): number => {
  const r = Math.max(0, Math.min(1, score / 100));
  return BUBBLE_SIZE_MIN_RPX + (BUBBLE_SIZE_MAX_RPX - BUBBLE_SIZE_MIN_RPX) * r;
};

/** 分值 → 等级标签（与内联版 tooltip 一致） */
export const scoreToGrade = (score: number): string => {
  if (score >= 85) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '中等';
  return '待提升';
};

/** 分值 → 一句话描述（与内联版 tooltip 一致） */
export const scoreToDesc = (label: string, score: number): string => {
  if (score >= 85) return `你的${label}表现突出，是求职核心竞争力`;
  if (score >= 75) return `你的${label}表现良好，继续保持即可`;
  if (score >= 60) return `你的${label}处于中等水平，还有提升空间`;
  return `你的${label}目前偏弱，建议优先补齐`;
};

// ====================== 几何计算 ======================

export interface RadarPoint {
  key: AbilityDimensionKey;
  label: string;
  /** 归一化 0~100 */
  score: number;
  /** 球体圆心坐标（CSS px） */
  x: number;
  y: number;
  /** 球体半径（CSS px） */
  radius: number;
}

export interface RadarGeometry {
  cx: number;
  cy: number;
  /** 正方形边长（CSS px） */
  side: number;
  /** 外圈半径（CSS px） */
  radius: number;
  points: RadarPoint[];
}

/** 每根轴的角度（第一维在正上方，其余逆时针排列，与内联版角度约定一致） */
const axisAngle = (index: number): number =>
  -Math.PI / 2 - index * ((Math.PI * 2) / DIMENSION_ORDER.length);

/**
 * 计算雷达几何：中心、外圈半径与十颗星球的坐标。
 *
 * @param rpxPx 1rpx 对应的 CSS px（由页面从 windowWidth / 750 算出）
 */
export const computeRadarGeometry = (
  dimensions: RadarDimensionInput[],
  width: number,
  height: number,
  rpxPx: number = FALLBACK_RPX_PX
): RadarGeometry => {
  const cx = width / 2;
  const cy = height / 2;
  // 内联版容器是正方形，这里取短边作为正方形边长，保证比例一致
  const side = Math.min(width, height);
  const radius = side * RADIUS_PERCENT;

  const points: RadarPoint[] = DIMENSION_ORDER.map((key, index) => {
    const hit = dimensions.find((d) => d.key === key);
    const score = typeof hit?.score === 'number' ? Math.max(0, Math.min(100, hit.score)) : 0;
    const angle = axisAngle(index);
    const radiusPx = radius * scoreToRadiusRatio(score);
    const diameterPx = scoreToBubbleSizeRpx(score) * rpxPx;
    return {
      key,
      label: hit?.label ?? key,
      score,
      x: cx + Math.cos(angle) * radiusPx,
      y: cy + Math.sin(angle) * radiusPx,
      radius: diameterPx / 2,
    };
  });

  return { cx, cy, side, radius, points };
};

// ====================== 绘制 ======================

/**
 * 绘制整张能力星球图，返回几何信息（页面用它做触摸命中检测）。
 *
 * 注意：ctx 已经按 dpr 缩放，这里的坐标单位都是 CSS px。
 */
export const drawRadar = (
  ctx: CanvasRenderingContext2D,
  dimensions: RadarDimensionInput[],
  width: number,
  height: number,
  rpxPx: number = FALLBACK_RPX_PX
): RadarGeometry => {
  const geometry = computeRadarGeometry(dimensions, width, height, rpxPx);
  const { cx, cy, side, radius, points } = geometry;
  const count = DIMENSION_ORDER.length;

  ctx.clearRect(0, 0, width, height);
  ctx.save();

  // ---------- 1. 同心圆网格（内联版是圆形，不是十边形） ----------
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = GRID_LINE_WIDTH;
  GRID_LEVELS.forEach((level) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * level, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ---------- 2. 坐标轴线：圆心 → 外圈 ----------
  ctx.beginPath();
  for (let i = 0; i < count; i += 1) {
    const angle = axisAngle(i);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.stroke();

  // ---------- 3. 数据多边形填充 ----------
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = AREA_COLOR;
  ctx.fill();

  // ---------- 4. 数据多边形轮廓（橘色细线，opacity 0.85） ----------
  ctx.save();
  ctx.globalAlpha = OUTLINE_ALPHA;
  ctx.strokeStyle = PRIMARY_COLOR;
  ctx.lineWidth = OUTLINE_LINE_WIDTH;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // ---------- 5. 维度标签（外圈之外的同心圆上，24rpx、#333） ----------
  const labelRadius = side * LABEL_RADIUS_PERCENT;
  const labelFontPx = Math.max(10, LABEL_FONT_RPX * rpxPx);
  ctx.fillStyle = '#333333';
  ctx.font = `${labelFontPx}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  points.forEach((p, i) => {
    const angle = axisAngle(i);
    const lx = cx + Math.cos(angle) * labelRadius;
    const ly = cy + Math.sin(angle) * labelRadius;
    ctx.fillText(p.label, lx, ly);
  });

  // ---------- 6. 星球（径向渐变、无描边、无发光） ----------
  points.forEach((p) => {
    const tier = scoreToTier(p.score);
    const [center, edge] = PLANET_GRADIENTS[tier];
    const r = Math.max(2, p.radius);
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    gradient.addColorStop(0, center);
    gradient.addColorStop(1, edge);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  ctx.restore();
  return geometry;
};

// ====================== 触摸命中检测 ======================

/**
 * 找出触摸点最近的星球（球体半径 + 8px 容差内），用于点击查看得分。
 *
 * @param geometry drawRadar 的返回值
 * @param x 触摸点横坐标（相对 canvas，CSS px）
 * @param y 触摸点纵坐标（相对 canvas，CSS px）
 */
export const hitTest = (
  geometry: RadarGeometry | null,
  x: number,
  y: number
): RadarPoint | null => {
  if (!geometry || !geometry.points.length) return null;

  let best: RadarPoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  geometry.points.forEach((p) => {
    const distance = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
    if (distance <= p.radius + HIT_TOLERANCE_EXTRA && distance < bestDistance) {
      bestDistance = distance;
      best = p;
    }
  });

  // 相邻星球可能挨得很近，取「最近且落在容差内」的一颗
  return best;
};
