/**
 * 能力星球图 —— ECharts option 构造器（微信小程序端）
 *
 * ## 画面结构（两层，从上到下）
 *   底层  series[0]：十维雷达（浅灰细网格 + 极淡橘色填充 + 细橘轮廓，无自带圆点）
 *   上层  series[1]：每根轴的分值位置上放一颗圆形星球，直径由分值决定
 *   层级用 z 明确区分：雷达 z=2，星球 z=10，星球永远压在折线之上
 *
 * ## ⚠️ 为什么 series[1] 不是 `coordinateSystem: 'radar'` 的 scatter
 *
 * ECharts 5 的雷达坐标系不对外提供数据到坐标的换算，把 scatter 挂到
 * `coordinateSystem: 'radar'` 上会被**静默丢弃**（不报错、也不渲染）。
 * 实测（echarts 5.6.0，SSR 渲染成 SVG 后数图形元素）：
 *   scatter + cartesian2d        → 5 个 symbol（对照组，正常）
 *   scatter + coordinateSystem:'radar' → 0 个，且无任何报错
 *
 * 所以这里用 **polar（极坐标系）承载星球**，并把 polar 自身线条全部隐藏，
 * 只当定位用。两套坐标系只要 center / radius 写成同一个值就**逐点重合**：
 * 实测雷达多边形顶点与星球中心偏差 ≤ 0.1px。
 *
 * 角度口径（这个坑必须记住）：
 *   - radar 默认 startAngle 90°、**逆时针**排列 indicator；
 *   - polar 的类目轴会把点放在扇区**中心**，与 radar 差 18°；
 *   - 因此改用 **value 型角度轴**：startAngle:90 + clockwise:false，
 *     数据传 `[分值, 序号*36]`，角度 = 90 + 序号*36，与 radar 完全一致，
 *     不依赖任何"魔法偏移量"。
 *
 * ## ⚠️ 小程序端注意事项
 *   1. option 里含**函数**（symbolSize / tooltip.formatter）。
 *      uni-echarts 取值顺序是 defaultTo(props.option, 注入值)，prop 优先；
 *      而小程序端组件 props 会被 setData 序列化，函数会全部丢失。
 *      所以必须用 provideEchartsOption 注入，不要写成 :option="..."。
 *   2. tooltip 在小程序里由 canvas 渲染，**不支持 HTML 标签**，
 *      所以 formatter 只用 `\n` 换行、纯文本，不用 <br> / <span>。
 *   3. 不涉及任何浏览器专属 API（无 document / window / Image）。
 *   4. 星球**不使用任何图片资源**：用圆形 symbol + 径向渐变模拟，
 *      所以也不存在「小程序 canvas 画不了 SVG」这类兼容性风险。
 *   5. 圆形加一圈同色系细描边（borderWidth: 1），让边缘清晰；
 *      描边是实线，不是发光，shadowBlur 全为 0。
 */

import type { AbilityDimensionKey } from '@/types/jobProfile';

// ====================== 可调常量 ======================

/**
 * 星球直径（px）：`Math.min(分值 * SYMBOL_SIZE_FACTOR, SYMBOL_SIZE_MAX)`
 *
 * 上限 32px 是为了避免相邻星球互相挤压 —— 十项按 36° 均分，
 * 分值高的相邻两颗如果都很大就会糊在一起。
 *
 * 系数说明：最初按需求取的 0.8，但那样 40 分以上就全部顶到 32px，
 * 十颗星球一样大，「用大小表达分值」这条就失效了。
 * 改成 0.32 后 100 分才刚好 32px，各分数段都能拉开（42 分 ≈ 13.4px、
 * 70 分 ≈ 22.4px、97 分 ≈ 31px），同时仍然封顶 32px 不会拥挤。
 */
export const SYMBOL_SIZE_MAX = 32;
export const SYMBOL_SIZE_FACTOR = 0.32;

/** 雷达与主色（对齐小程序全局色） */
const LINE_COLOR = '#EEEEEE';
const PRIMARY_COLOR = '#FF9771';
/** 多边形填充：极淡，只做底，不抢星球的视觉 */
const AREA_COLOR = 'rgba(255, 151, 113, 0.04)';

/** 网格线宽：比原来更细，弱化参考线 */
const GRID_LINE_WIDTH = 0.5;
/** 雷达轮廓线宽 */
const OUTLINE_LINE_WIDTH = 1.5;

/** 雷达中心与半径：radar 与 polar 必须写成同一组值，否则星球会和骨架错位 */
const CENTER: [string, string] = ['50%', '50%'];
const RADIUS = '58%';

/**
 * 维度标签与雷达外圈的间距（px）
 *
 * ECharts 雷达的 `axisNameGap`，默认只有 15，标签几乎贴着外圈，
 * 高分的星球会顶到标签上。这里加大到 30，把十个维度名整体推到星球外侧。
 */
const AXIS_NAME_GAP = 30;

/**
 * 十个维度的展示顺序
 *
 * 用的是项目里真实存在的 key（见 types/jobProfile.ts 的 JOB_DIMENSIONS）。
 * 取分时按 key 匹配而不是按数组下标，这样后端返回顺序变了雷达轴也不会串位。
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

// ====================== 星球外观（纯渐变，不用图片）======================

/**
 * 三档星球的径向渐变色：[中心色, 边缘色]
 *
 * 中心主色 → 边缘同色系浅色，形成「由中心向边缘变淡」的柔和球感。
 * 全程不设 shadowBlur —— 向外的发光是廉价 AI 感的主要来源。
 */
export const PLANET_GRADIENTS = {
  /** 分值 ≥ 80：暖橘 */
  high: ['#FF9771', '#FFD9C7'],
  /** 70 ≤ 分值 < 80：浅橙黄 */
  mid: ['#FFB347', '#FFD291'],
  /** 分值 < 70：浅灰 */
  low: ['#E2E2E2', '#F1F1F1'],
} as const;

/**
 * 三档描边色：比同档中心色深一档，用来给圆形勾一个清晰的边
 *
 * 只用同色系深色，不用白色、不用半透明发光 —— 目的是让边缘清晰，
 * 不是让球亮起来。
 */
export const PLANET_BORDERS = {
  high: '#E8703F',
  mid: '#DFA030',
  low: '#B9BFC9',
} as const;

// ====================== 取值辅助 ======================

export interface RadarDimensionInput {
  key: AbilityDimensionKey;
  /** 维度中文名（用画像里的 label，保证和「十维明细」用词一致） */
  label: string;
  /** 0~100 */
  score: number;
}

/** 分值 → 档位（决定配色） */
export const scoreToTier = (score: number): keyof typeof PLANET_GRADIENTS => {
  if (score >= 80) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
};

/**
 * 分值 → 星球直径（px）
 *
 * `Math.min(分值 * 0.32, 32)`：100 分刚好顶到上限，
 * 中间分数都能看出大小差别（详见 SYMBOL_SIZE_FACTOR 上的说明）。
 */
export const scoreToSymbolSize = (score: number): number => {
  const safe = Math.max(0, Math.min(100, score));
  return Math.min(safe * SYMBOL_SIZE_FACTOR, SYMBOL_SIZE_MAX);
};

/** 分值 → 等级标签 */
export const scoreToGrade = (score: number): string => {
  if (score >= 85) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '中等';
  return '待提升';
};

/** 分值 → 一句人话描述 */
export const scoreToDesc = (label: string, score: number): string => {
  if (score >= 85) return `你的${label}表现突出，是求职核心竞争力`;
  if (score >= 75) return `你的${label}表现良好，继续保持即可`;
  if (score >= 60) return `你的${label}处于中等水平，还有提升空间`;
  return `你的${label}目前偏弱，建议优先补齐`;
};

/**
 * 分值 → 圆形星球的填充色（ECharts 径向渐变对象）
 *
 * x / y / r 都取 0.5：渐变圆心在正中间，**不做偏心高光**，
 * 对应需求里的「不要白色高光点、不做立体球」。
 */
export const scoreToPlanetFill = (score: number) => {
  const [center, edge] = PLANET_GRADIENTS[scoreToTier(score)];
  return {
    type: 'radial' as const,
    x: 0.5,
    y: 0.5,
    r: 0.5,
    colorStops: [
      { offset: 0, color: center },
      { offset: 1, color: edge },
    ],
  };
};

/**
 * 分值 → 一颗星球的完整 itemStyle（径向渐变 + 同色系细描边 + 无发光）
 *
 * 页面侧直接把这个对象挂到数据项上即可。
 */
export const scoreToPlanetStyle = (score: number) => {
  const tier = scoreToTier(score);
  return {
    color: scoreToPlanetFill(score),
    borderColor: PLANET_BORDERS[tier],
    borderWidth: 1,
    // 显式关闭一切阴影：只保留渐变与描边，不做任何向外扩散的模糊光晕
    shadowBlur: 0,
    shadowColor: 'transparent',
  };
};

// ====================== option ======================

/**
 * 生成能力星球图的 ECharts option
 *
 * @param dimensions 画像里的十维数据；顺序无所谓，内部会按 DIMENSION_ORDER 重排并按 key 取分
 */
export const buildAbilityRadarOption = (
  dimensions: RadarDimensionInput[]
): Record<string, unknown> => {
  // 按固定顺序重排 + 按 key 取分（缺维度补 0，避免整张图崩掉）
  const ordered = DIMENSION_ORDER.map((key) => {
    const hit = dimensions.find((d) => d.key === key);
    return {
      key,
      label: hit?.label ?? key,
      score: typeof hit?.score === 'number' ? hit.score : 0,
    };
  });

  return {
    // 入场动画短一点，小程序首屏不要拖
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',

    // ---------------- tooltip：点击弹出 ----------------
    tooltip: {
      // 雷达/散点都是"项"级数据，按项触发
      trigger: 'item',
      // 小程序是触屏，鼠标 hover 不存在，所以明确用点击触发
      triggerOn: 'click',
      // 限制在画布内，避免弹窗被裁
      confine: true,
      backgroundColor: '#fff7f2',
      borderColor: PRIMARY_COLOR,
      borderWidth: 1,
      // ECharts 的圆角单位是 px（不是 rpx）；16 对应设计稿约 32rpx 的圆角
      borderRadius: 16,
      padding: [10, 14],
      textStyle: {
        color: '#333333',
        fontSize: 12,
        lineHeight: 19,
      },
      /**
       * canvas 渲染的 tooltip 不认 HTML 标签，所以只用 \n 换行、纯文本输出。
       * 四块信息合三行：维度名称｜分数 / 【等级】/ 简短描述
       */
      formatter: (params: { data?: { name?: string }; value?: unknown; name?: string }) => {
        const label = params?.data?.name || params?.name || '';
        const raw = Array.isArray(params?.value) ? params.value[0] : params?.value;
        const score = typeof raw === 'number' ? raw : 0;
        return [
          `${label}｜${score}分`,
          `【${scoreToGrade(score)}】`,
          scoreToDesc(label, score),
        ].join('\n');
      },
    },

    // ---------------- 底层：雷达骨架 ----------------
    radar: {
      indicator: ordered.map((d) => ({ name: d.label, max: 100 })),
      center: CENTER,
      radius: RADIUS,
      shape: 'polygon',
      startAngle: 90,
      splitNumber: 4,
      /**
       * 维度标签到外圈的间距：默认 15 太小，高分星球会压到文字上；
       * 调到 30 把十个维度名整体推到星球外侧
       */
      axisNameGap: AXIS_NAME_GAP,
      axisName: {
        color: '#333333',
        fontSize: 11,
      },
      // 坐标轴线 / 分割线：浅灰细线，弱化存在感，只作参考
      axisLine: {
        lineStyle: { color: LINE_COLOR, width: GRID_LINE_WIDTH },
      },
      splitLine: {
        lineStyle: { color: LINE_COLOR, width: GRID_LINE_WIDTH },
      },
      // 关掉分割区域的背景色块，画面保持干净
      splitArea: {
        show: false,
      },
    },

    // ---------------- 承载星球的极坐标系（自身线条全部隐藏）----------------
    // 只用来给 series[1] 定位，不画任何东西；center/radius 必须与 radar 一致
    polar: {
      center: CENTER,
      radius: RADIUS,
    },
    angleAxis: {
      type: 'value',
      min: 0,
      max: 360,
      // 关闭刻度对齐：本坐标系只用于定位、不画刻度，
      // 开着会让 ECharts 反复告警 "ticks may be not readable"
      alignTicks: false,
      startAngle: 90,
      // radar 是逆时针排列的，这里必须跟着逆时针，否则星球会和轴错开
      clockwise: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    radiusAxis: {
      type: 'value',
      min: 0,
      max: 100,
      alignTicks: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },

    // ---------------- 两个 series ----------------
    series: [
      // series[0]：雷达轮廓线 + 极淡填充，关闭自带圆点
      {
        type: 'radar',
        name: '能力轮廓',
        symbol: 'none',
        lineStyle: {
          color: PRIMARY_COLOR,
          width: OUTLINE_LINE_WIDTH,
        },
        areaStyle: {
          color: AREA_COLOR,
          /**
           * 必须显式写回 1：
           * ECharts 的雷达系列默认 areaStyle.opacity = 0.7，
           * 会把 rgba(...,0.04) 再乘 0.7 变成 0.028（实测 fill-opacity=0.0279…），
           * 比需求要的填充还淡三成。
           */
          opacity: 1,
        },
        // 禁止任何外发光
        itemStyle: {
          shadowBlur: 0,
          shadowColor: 'transparent',
        },
        // z 比星球小：折线永远在星球下层
        z: 2,
        // 轮廓只做底，不参与交互（tooltip 交给星球）
        silent: true,
        data: [{ value: ordered.map((d) => d.score) }],
      },

      // series[1]：十颗顶点星球（分值 → 配色 + 直径），纯圆形 symbol，无图片
      {
        type: 'scatter',
        name: '能力星球',
        coordinateSystem: 'polar',
        // 统一用圆形；球感完全由 itemStyle 里的径向渐变提供
        symbol: 'circle',
        // 分值决定直径：Math.min(分值 * 0.32, 32)；value 是 [分值, 角度]
        symbolSize: (value: unknown) => {
          const raw = Array.isArray(value) ? value[0] : value;
          return scoreToSymbolSize(typeof raw === 'number' ? raw : 0);
        },
        itemStyle: {
          // 兜底：即使某一项没带 itemStyle，也不会有任何外发光
          shadowBlur: 0,
          shadowColor: 'transparent',
        },
        // 悬停只轻微放大，不做闪光/爆炸效果
        emphasis: {
          scale: 1.1,
          itemStyle: {
            shadowBlur: 0,
          },
        },
        // z 最大：星球永远在最顶层
        z: 10,
        data: ordered.map((d, i) => ({
          name: d.label,
          // 第二项是角度值：序号 × 36°，配合 startAngle:90 + clockwise:false 与 radar 对齐
          value: [d.score, i * 36],
          // 每颗球按自己的分数取样式：径向渐变 + 同色系细描边
          itemStyle: scoreToPlanetStyle(d.score),
        })),
      },
    ],
  };
};
