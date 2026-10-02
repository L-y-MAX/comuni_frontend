/**
 * 能力星球图 —— ECharts option 构造器（微信小程序端）
 *
 * ## 画面结构（两层）
 *   底层  series[0]：标准十维雷达（浅灰分割线 + 淡橘半透明填充 + 橘色轮廓，无自带圆点）
 *   上层  series[1]：每个维度顶点一颗简笔土星球，直径由分值决定
 *
 * ## ⚠️ 为什么 series[1] 不是 `coordinateSystem: 'radar'` 的 scatter
 *
 * ECharts 5 的雷达坐标系**不对外提供**数据到坐标的换算，把 scatter 挂到
 * `coordinateSystem: 'radar'` 上会被**静默丢弃**（不报错、也不渲染）。
 * 实测（echarts 5.6.0，SSR 渲染成 SVG 后数图形元素）：
 *   - scatter + coordinateSystem:'cartesian2d' → 渲染出 5 个 symbol（对照组，正常）
 *   - scatter + coordinateSystem:'radar'       → 渲染出 0 个，且无任何报错
 *
 * 所以这里用 **polar（极坐标系）承载星球图标**，并把 polar 自身线条全部隐藏，
 * 只当定位用。两套坐标系只要 center / radius 写成同一个值就**逐点重合**：
 * 实测 radar 多边形顶点与 polar 上的图标中心偏差 ≤ 0.1px。
 *
 * 角度口径（这个坑必须记住）：
 *   - radar 默认 startAngle 90°、**逆时针**排列 indicator；
 *   - polar 的类目轴（type:'category'）会把点放在扇区**中心**，与 radar 差 18°；
 *   - 因此这里改用 **value 型角度轴**：startAngle:90 + clockwise:false，
 *     数据传 `[分值, 序号*36]`，角度 = 90 + 序号*36，与 radar 完全一致，
 *     不依赖任何"魔法偏移量"。
 *
 * ## ⚠️ 小程序端注意事项
 *   1. option 里含**函数**（symbol / symbolSize / tooltip.formatter）。
 *      必须直接把对象交给 `chart.setOption(option)`；
 *      若经 `setData` 传递会被 JSON 序列化，函数全部丢失，
 *      表现为：图标不变色、大小不随分数变化、tooltip 不显示内容。
 *   2. tooltip 在小程序里由 canvas 渲染（富文本模式），**不支持 HTML 标签**。
 *      所以 formatter 只用 `\n` 换行、纯文本，不用 <br> / <span>。
 *   3. 不涉及任何浏览器专属 API（无 document / window / Image）。
 *   4. 星球**不使用任何图片资源**：用圆形 symbol + 径向渐变模拟，
 *      所以也不存在「小程序 canvas 画不了 SVG」这类兼容性风险。
 */

import type { AbilityDimensionKey } from '@/types/jobProfile';

// ====================== 可调常量 ======================

/**
 * 三档星球的径向渐变色：[中心色, 边缘色]
 *
 * 用 ECharts 的径向渐变对象直接填充圆形 symbol，不用任何图片资源：
 * 中心是主色、边缘是同色系更浅的色，形成「由中心向边缘变淡」的柔和球感。
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
 * 星球直径区间（px）
 *
 * 上限 45 是硬约束：十项按 36° 均分，分值高的相邻两颗如果都很大就会挤在一起。
 * 实测最紧的一对（两个低分维度同时靠近圆心）在 45px 上限下仍留有约 28px 空隙。
 */
export const SYMBOL_SIZE_MIN = 18;
export const SYMBOL_SIZE_MAX = 45;

/** 线条与主色（对齐小程序全局色） */
const LINE_COLOR = '#EEEEEE';
const PRIMARY_COLOR = '#FF9771';
const AREA_COLOR = 'rgba(255, 151, 113, 0.08)';

/** 雷达中心与半径：radar 与 polar 必须写成同一组值，否则图标会和骨架错位 */
const CENTER: [string, string] = ['50%', '50%'];
const RADIUS = '62%';

/**
 * 十个维度的展示顺序
 *
 * 注意：这里用的是**项目里真实存在的 key**（见 types/jobProfile.ts 的 JOB_DIMENSIONS）。
 * 顺序按需求给定；取分时按 key 匹配而不是按数组下标，
 * 这样即使后端返回的顺序变了，雷达轴也不会串位。
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
  /** 维度中文名（直接用画像里的 label，避免和「十维明细」用词不一致） */
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
 * 分值 → 圆形星球的填充色（ECharts 径向渐变对象）
 *
 * x / y / r 都取 0.5：渐变圆心在正中间，**不做偏心高光**，
 * 对应需求里的「不要白色高光点、不做立体球」。
 * 中心用主色、边缘用浅色，视觉上就是一颗从中心往边缘化开的星球。
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
 * 分值 → 星球直径（px）
 *
 * 线性铺满 0~100：18px（0 分）→ 45px（100 分）。
 * 这样 45 只是满分的天花板，中间分数都能看出大小差别。
 * （早先版本斜率取 1.5，导致 67 分以上全部顶到 45px，十颗星球几乎一样大。）
 */
export const scoreToSymbolSize = (score: number): number => {
  const safe = Math.max(0, Math.min(100, score));
  return SYMBOL_SIZE_MIN + (safe / 100) * (SYMBOL_SIZE_MAX - SYMBOL_SIZE_MIN);
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

    // ---------------- tooltip ----------------
    tooltip: {
      trigger: 'item',
      // 小程序画布不大，限制在画布内，避免弹窗被裁
      confine: true,
      backgroundColor: '#fff7f2',
      borderColor: PRIMARY_COLOR,
      borderWidth: 1,
      borderRadius: 16,
      padding: [10, 14],
      textStyle: {
        color: '#333333',
        fontSize: 12,
        lineHeight: 19,
      },
      /**
       * canvas 渲染的 tooltip 不认 HTML 标签，所以只用 \n 换行、纯文本输出。
       * 三行：维度｜分数 / 【等级】/ 能力描述
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
      // 维度文字：放在雷达外圈之外（ECharts 的 axisName 天然在轴末端外侧）
      axisName: {
        color: '#333333',
        fontSize: 11,
      },
      // 坐标轴线 / 分割线：统一浅灰，弱化存在感，不抢星球的视觉
      axisLine: {
        lineStyle: { color: LINE_COLOR, width: 1 },
      },
      splitLine: {
        lineStyle: { color: LINE_COLOR, width: 1 },
      },
      // 关掉分割区域的背景色块，画面保持干净
      splitArea: {
        show: false,
      },
    },

    // ---------------- 承载星球图标的极坐标系（自身线条全部隐藏）----------------
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
      // radar 是逆时针排列的，这里必须跟着逆时针，否则图标会和轴错开
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
      // series[0]：雷达轮廓线 + 淡橘半透明填充，关闭自带圆点
      {
        type: 'radar',
        name: '能力轮廓',
        symbol: 'none',
        lineStyle: {
          color: PRIMARY_COLOR,
          width: 2,
        },
        areaStyle: {
          color: AREA_COLOR,
        },
        // 禁止任何外发光
        itemStyle: {
          shadowBlur: 0,
          shadowColor: 'transparent',
        },
        // 轮廓只做底，不参与交互（tooltip 交给星球图标）
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
        // 分值决定直径；value 是 [分值, 角度]，所以取第一个元素
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
        z: 10,
        data: ordered.map((d, i) => ({
          name: d.label,
          // 第二项是角度值：序号 × 36°，配合 startAngle:90 + clockwise:false 与 radar 对齐
          value: [d.score, i * 36],
          // 每颗球按自己的分数取径向渐变（中心主色 → 边缘浅色）
          itemStyle: {
            color: scoreToPlanetFill(d.score),
          },
        })),
      },
    ],
  };
};
