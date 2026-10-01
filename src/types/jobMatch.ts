/**
 * 人岗智能匹配 —— 数据模型
 *
 * 对应计划书《职途智行》核心功能板块(3)「人岗智能匹配与职业探索」：
 * 以岗位画像与学生能力画像为基础，通过向量相似度计算实现精准人岗匹配，
 * 从**专业技能、证书水平、实践经历、综合素质**四大维度综合计算匹配度，
 * 并明确指出具体不足项（如"MySQL、Redis 熟练度不足、计算机二级未获取、实践经历偏少"），
 * 同步提供针对性提升建议与适配岗位列表。
 *
 * ## 匹配的基本约定
 *
 * 两侧画像共用同一套十维基准（JOB_DIMENSIONS），但**分值语义相反**：
 *   - 岗位侧：分值高 = 该岗位对这一维度要求高（门槛高）
 *   - 学生侧：分值高 = 该学生在这一维度能力强
 * 因此匹配度不能直接比大小，而要判断「学生是否达到岗位要求」，
 * 即 fit = min(1, 学生分 / 岗位要求分)。
 *
 * ## 关于「向量相似度」
 *
 * 计划书提到用向量相似度算法。本实现采用**置信度加权的十维比例匹配**，
 * 它与余弦相似度在方向上等价（都是多维向量的相似性度量），但有两个更适合本场景的性质：
 *   1. 岗位要求与个人能力是**有向的**——超出要求不加分、达不到要求要扣分，
 *      而余弦相似度是对称的，无法表达这种方向性；
 *   2. 可以按「解析置信度」给维度降权，把不确定的维度影响压下去。
 * 若后端改用真实向量模型，只需替换 utils/jobMatch.ts 的打分函数，接口结构无需改动。
 */

import type { AbilityDimensionKey } from './jobProfile';
import type { SkillProficiency } from './studentProfile';

// ====================== 四大类目 ======================

/** 匹配类目键（对齐计划书的四大维度） */
export type MatchCategoryKey =
  | 'professional_skill' // 专业技能
  | 'certificate' // 证书水平
  | 'practice' // 实践经历
  | 'overall_quality'; // 综合素质

export interface MatchCategoryMeta {
  key: MatchCategoryKey;
  label: string;
  /** 类目权重，四类合计为 1 */
  weight: number;
  /** 该类目由哪些十维维度构成 */
  dimensions: AbilityDimensionKey[];
  description: string;
}

/**
 * 四大类目配置。
 *
 * 十维 → 四类的归并关系：
 *   专业技能 = 专业技能
 *   证书水平 = 证书资质
 *   实践经历 = 实习能力
 *   综合素质 = 创新能力/学习能力/抗压能力/沟通能力/团队协作/逻辑思维/行业认知
 *
 * 权重依据：校招场景中硬技能与实践经历是筛选的第一道门槛，
 * 综合素质决定长期发展，证书属于加分项，故权重依次递减。
 */
export const MATCH_CATEGORIES: MatchCategoryMeta[] = [
  {
    key: 'professional_skill',
    label: '专业技能',
    weight: 0.35,
    dimensions: ['professional_skill'],
    description: '岗位硬技能要求的达成度',
  },
  {
    key: 'certificate',
    label: '证书水平',
    weight: 0.1,
    dimensions: ['certificate'],
    description: '岗位要求证书的持有情况',
  },
  {
    key: 'practice',
    label: '实践经历',
    weight: 0.2,
    dimensions: ['internship'],
    description: '实习、项目等实践经历的匹配度',
  },
  {
    key: 'overall_quality',
    label: '综合素质',
    weight: 0.35,
    dimensions: [
      'innovation',
      'learning',
      'stress_resistance',
      'communication',
      'teamwork',
      'logical_thinking',
      'industry_cognition',
    ],
    description: '通用职业素养的综合达成度',
  },
];

/** 匹配等级 */
export type MatchLevel = 'excellent' | 'good' | 'fair' | 'low';

export const MATCH_LEVEL_LABEL: Record<MatchLevel, string> = {
  excellent: '高度匹配',
  good: '较为匹配',
  fair: '基本匹配',
  low: '匹配度偏低',
};

/** 分值 → 匹配等级 */
export const scoreToMatchLevel = (score: number): MatchLevel => {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  return 'low';
};

export const MATCH_LEVEL_COLOR: Record<MatchLevel, string> = {
  excellent: '#16a34a',
  good: '#ff4500',
  fair: '#f59e0b',
  low: '#94a3b8',
};

// ====================== 逐维度差距 ======================

/**
 * 达成度的计算依据。
 *
 * 专业技能与证书资质按「岗位要求的条目覆盖率」衡量，其余维度按「分值比例」衡量。
 * 两者必须显式区分并一路传到界面：否则同一维度会出现
 * 「类目得分 50（覆盖率口径）」与「表格里写差 8 分（分值口径）」并存的自相矛盾。
 */
export type FitBasis = 'coverage' | 'score';

/** 覆盖率口径下，达到该比例即视为该项达标 */
export const COVERAGE_SATISFY_THRESHOLD = 0.8;

export interface DimensionGap {
  key: AbilityDimensionKey;
  label: string;
  /** 学生在该维度的能力分 */
  studentScore: number;
  /** 岗位在该维度的要求分 */
  requiredScore: number;
  /** 差距 = 要求 - 学生（正数表示不足，负数表示超出） */
  gap: number;
  /** 该维度达成度 0-1 */
  fit: number;
  /** 达成度的计算依据 */
  basis: FitBasis;
  /**
   * 该维度的达成度百分比 0-100。
   * basis='coverage' 时为技能/证书覆盖率，basis='score' 时为分值达成比例。
   * 界面与导出统一用这个值展示"达成度"，保证口径一致。
   */
  fitPercent: number;
  /** 是否达到要求（判定口径与 basis 一致） */
  satisfied: boolean;
  /**
   * 学生侧信息是否不足（置信度低于阈值）。
   * 用于界面区分「确实不达标」和「只是没写」——后者不该显示成"差 X 分"。
   */
  insufficientInfo: boolean;
  /**
   * 岗位是否**未对该维度提出有效要求**（维度分低于阈值且未列出具体技能/证书）。
   * 这类维度不参与加权：没提要求 ≠ 达标，把它算成满分会让
   * "要求写得越少的岗位越容易被匹配上"。
   */
  noRequirement: boolean;
  /** 折算后的有效权重（已按双方置信度降权；未提要求的维度为 0） */
  effectiveWeight: number;
}

// ====================== 技能 / 证书缺口 ======================

export interface SkillGap {
  name: string;
  /** 岗位对该技能的要求强度 */
  requirement: 'must' | 'preferred';
  /** 学生是否具备 */
  possessed: boolean;
  /** 学生具备时的熟练度声明 */
  studentProficiency?: SkillProficiency;
}

export interface CertGap {
  name: string;
  requirement: 'must' | 'preferred';
  possessed: boolean;
}

// ====================== 匹配结果 ======================

export interface MatchCategoryResult {
  key: MatchCategoryKey;
  label: string;
  /** 该类目得分 0-100 */
  score: number;
  /** 类目权重 */
  weight: number;
  description: string;
  /**
   * 该类目是否参与总评。
   * 类目下所有维度岗位都没提要求时（例如某岗位完全没写证书要求），
   * 该项标记为 false：得分为 0 且从总评权重中剔除，避免拉低整体匹配度。
   */
  active: boolean;
}

export interface MatchResult {
  /** 岗位标识（招聘记录信用代码；示例岗位用固定 id） */
  jobId: string;
  jobName: string;
  enterpriseName: string;
  industry: string;

  /** 综合匹配度 0-100 */
  matchScore: number;
  matchLevel: MatchLevel;
  /** 匹配等级中文名 */
  matchLevelLabel: string;

  /** 四大类目得分 */
  categories: MatchCategoryResult[];
  /** 十维逐项差距 */
  gaps: DimensionGap[];
  /** 达到要求的维度数 / 总维度数 */
  satisfiedCount: number;
  totalCount: number;

  /** 技能缺口（岗位要求但学生未体现） */
  skillGaps: SkillGap[];
  /** 证书缺口 */
  certGaps: CertGap[];
  /** 硬技能缺口数量（岗位标为「必须」但学生没有） */
  missingMustSkills: number;

  /** 关键短板描述，如「MySQL、Redis 熟练度不足」 */
  criticalGaps: string[];
  /** 针对性提升建议 */
  suggestions: string[];

  /** 匹配置信度 0-1（取决于两侧画像的解析质量） */
  confidence: number;
  /** 结论摘要 */
  summary: string;
  /** 是否为基础匹配（两侧画像任一来自本地规则解析） */
  isRuleBased: boolean;
}

// ====================== 常量 ======================

/** 达成度容差：学生分比要求低不超过这个值即视为「达标」，避免 59 vs 60 这类噪音 */
export const SATISFY_TOLERANCE = 3;

/** 视为「显著短板」的最小差距 */
export const SIGNIFICANT_GAP = 15;

/** 学生侧置信度低于该值时，视为「信息不足」而非「不达标」 */
export const INSUFFICIENT_INFO_CONFIDENCE = 0.35;

/** 硬技能缺口扣分上限 */
export const MAX_SKILL_PENALTY = 12;
