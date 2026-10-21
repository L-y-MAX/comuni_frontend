/**
 * 能力星球图 —— 原生 Canvas 2D 自绘引擎（替代 ECharts）
 *
 * ## 为什么不用 ECharts
 *
 * 整张图只有两种图形：「十维多边形」与「十个顶点星球」。
 * ECharts 即使按需打包（radar + scatter + polar + canvas 渲染器）并经 terser 压缩，
 * 产物仍有约 470KB，占整个分包近一半体积，还会触发开发者工具「静态资源超过 200KB」告警。
 * 用小程序原生 canvas 2d 手绘，逻辑只有百来行、体积可忽略，并且渲染行为完全可控。
 *
 * ## 画面结构（与旧版视觉保持一致的参数）
 *
 *   骨架：4 层同心十边形网格 + 10 条轴线，浅灰细线（#EEEEEE，0.5px）
 *   外轮廓：十维数据连成的多边形，极淡橘色填充 + 细橘色描边
 *   星球：每根轴按「分值/100」的位置画一颗圆球，直径由分值决定（最大 32px）
 *         三档渐变（≥80 暖橘 / 70~79 浅橙黄 / <70 浅灰），1px 同色系描边，无发光
 *   标签：维度中文名放在轴线外端 30px 处，按象限自适应对齐
 *
 * ## 交互
 *
 *   canvas 不能像 DOM 一样挂点击事件到图形上，所以采用「触摸命中检测」：
 *   记录每颗星球在画布上的坐标，触摸时找最近的一颗（28px 容差），
 *   命中则由页面弹出一张浮层卡片展示「维度｜分数 / 等级 / 一句话描述」。
 */

import type { AbilityDimensionKey } from '@/types/jobProfile';

// ====================== 视觉常量（与旧 ECharts 版一致） ======================

export const LINE_COLOR = '#EEEEEE';
export const PRIMARY_COLOR = '#FF9771';
/** 多边形填充：极淡，只做底，不抢星球的视觉 */
export const AREA_COLOR = 'rgba(255, 151, 113, 0.04)';
/** 网格线宽：细线弱化参考线 */
const GRID_LINE_WIDTH = 0.5;
/** 外轮廓线宽 */
const OUTLINE_LINE_WIDTH = 1.5;
/** 维度标签与外圈的间距（px），防止高分星球压住文字 */
const AXIS_NAME_GAP = 30;
/** 网格层数 */
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

/** 三档星球的径向渐变：[中心色, 边缘色] */
export const PLANET_GRADIENTS = {
  /** 分值 ≥ 80：暖橘 */
  high: ['#FF9771', '#FFD9C7'],
  /** 70 ≤ 分值 < 80：浅橙黄 */
  mid: ['#FFB347', '#FFD291'],
  /** 分值 < 70：浅灰 */
  low: ['#E2E2E2', '#F1F1F1'],
} as const;

/** 三档描边色：比同档中心色深一档，只让边缘清晰，不做发光 */
export const PLANET_BORDERS = {
  high: '#E8703F',
  mid: '#DFA030',
  low: '#B9BFC9',
} as const;

/** 星球直径上限（px），避免相邻两颗大星球糊在一起 */
export const SYMBOL_SIZE_MAX = 32;
/** 直径系数：100 分刚好顶到上限 */
export const SYMBOL_SIZE_FACTOR = 0.32;

/** 触摸命中容差（px） */
const HIT_TOLERANCE = 28;

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

/** 分值 → 星球直径（px）：min(分值 × 0.32, 32) */
export const scoreToSymbolSize = (score: number): number => {
  const safe = Math.max(0, Math.min(100, score));
  return Math.min(safe * SYMBOL_SIZE_FACTOR, SYMBOL_SIZE_MAX);
};

/** 分值 → 等级标签（与旧版 tooltip 一致） */
export const scoreToGrade = (score: number): string => {
  if (score >= 85) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '中等';
  return '待提升';
};

/** 分值 → 一句话描述（与旧版 tooltip 一致） */
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
  /** 星球圆心坐标（CSS px） */
  x: number;
  y: number;
  /** 星球半径（CSS px） */
  radius: number;
}

export interface RadarGeometry {
  cx: number;
  cy: number;
  /** 外圈半径（CSS px） */
  radius: number;
  points: RadarPoint[];
}

/**
 * 计算雷达几何：中心、外圈半径与十颗星球的坐标。
 *
 * 角度口径：第一维在正上方，其余维度**逆时针**排列（与旧 ECharts radar 的
 * startAngle=90、默认逆时针一致），保证换实现后画面方向不变。
 */
export const computeRadarGeometry = (
  dimensions: RadarDimensionInput[],
  width: number,
  height: number
): RadarGeometry => {
  const cx = width / 2;
  const cy = height / 2;
  // 旧版 radius: '58%' 指「短边一半的 58%」
  const radius = (Math.min(width, height) / 2) * 0.58;
  const step = (Math.PI * 2) / DIMENSION_ORDER.length;

  const points: RadarPoint[] = DIMENSION_ORDER.map((key, index) => {
    const hit = dimensions.find((d) => d.key === key);
    const score = typeof hit?.score === 'number' ? Math.max(0, Math.min(100, hit.score)) : 0;
    const angle = -Math.PI / 2 - index * step;
    const ratio = score / 100;
    return {
      key,
      label: hit?.label ?? key,
      score,
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
      radius: scoreToSymbolSize(score) / 2,
    };
  });

  return { cx, cy, radius, points };
};

/** 每根轴的角度（与 computeRadarGeometry 同一口径） */
const axisAngle = (index: number): number =>
  -Math.PI / 2 - index * ((Math.PI * 2) / DIMENSION_ORDER.length);

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
  height: number
): RadarGeometry => {
  const geometry = computeRadarGeometry(dimensions, width, height);
  const { cx, cy, radius, points } = geometry;
  const count = DIMENSION_ORDER.length;

  ctx.clearRect(0, 0, width, height);
  ctx.save();

  // ---------- 1. 同心十边形网格 ----------
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = GRID_LINE_WIDTH;
  GRID_LEVELS.forEach((level) => {
    ctx.beginPath();
    for (let i = 0; i < count; i += 1) {
      const angle = axisAngle(i);
      const x = cx + Math.cos(angle) * radius * level;
      const y = cy + Math.sin(angle) * radius * level;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  });

  // ---------- 2. 轴线 ----------
  ctx.beginPath();
  for (let i = 0; i < count; i += 1) {
    const angle = axisAngle(i);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.stroke();

  // ---------- 3. 数据多边形 ----------
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = AREA_COLOR;
  ctx.fill();
  ctx.strokeStyle = PRIMARY_COLOR;
  ctx.lineWidth = OUTLINE_LINE_WIDTH;
  ctx.stroke();

  // ---------- 4. 维度标签 ----------
  ctx.fillStyle = '#333333';
  ctx.font = '10px sans-serif';
  points.forEach((p, i) => {
    const angle = axisAngle(i);
    const lx = cx + Math.cos(angle) * (radius + AXIS_NAME_GAP);
    const ly = cy + Math.sin(angle) * (radius + AXIS_NAME_GAP);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ctx.textAlign = cos > 0.3 ? 'left' : cos < -0.3 ? 'right' : 'center';
    ctx.textBaseline = sin > 0.3 ? 'top' : sin < -0.3 ? 'bottom' : 'middle';
    ctx.fillText(p.label, lx, ly);
  });

  // ---------- 5. 星球（径向渐变 + 细描边，无发光） ----------
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
    ctx.strokeStyle = PLANET_BORDERS[tier];
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  ctx.restore();
  return geometry;
};

// ====================== 触摸命中检测 ======================

/**
 * 找出触摸点最近的星球（容差内），用于点击查看得分。
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
  let bestDistance = HIT_TOLERANCE;

  geometry.points.forEach((p) => {
    const distance = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = p;
    }
  });

  // 相邻星球之间可能挨得很近，取「最近且小于容差」的一颗
  return best;
};
