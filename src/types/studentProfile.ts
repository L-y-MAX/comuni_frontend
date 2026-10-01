/**
 * 学生就业能力画像（Student Profile）数据模型
 *
 * 对应计划书《职途智行》核心功能板块(2)「学生就业能力画像构建」：
 * 学生通过简历上传或手动录入提交个人专业背景、技能证书、项目经历、
 * 实习经验、获奖情况、职业意向等信息，由大模型完成信息抽取、结构化拆解、
 * 能力量化评估，自动生成多维度学生就业能力画像，并输出
 * **信息完整度评分** 与 **综合就业竞争力评分**，
 * 以「能力星球图 + 职业徽章墙」可视化展示。
 *
 * 设计要点：
 * 1. 十个维度**完全复用岗位画像的同一套基准**（@/types/jobProfile 的 JOB_DIMENSIONS），
 *    这是后续「人岗智能匹配」能按同一把尺子比对的前提。
 * 2. 岗位侧维度的语义是「岗位要求的强度」，学生侧是「学生具备的水平」——
 *    分值区间一致（0-100）、方向相反（岗位分高=门槛高，学生分高=能力强）。
 * 3. 额外输出 completeness（信息完整度）与 competitiveness（综合竞争力）两个总评分。
 */

import {
  JOB_DIMENSIONS,
  JOB_DIMENSION_KEYS,
  LEVEL_LABEL,
  levelToScore,
  scoreToLevel,
  type AbilityDimensionKey,
  type AbilityLevel,
  type ParseSource,
} from './jobProfile';

// ====================== 学生侧的技能 / 证书条目 ======================

/**
 * 技能熟练度声明。
 * 注意与岗位侧的 `RequirementStrength`（岗位要求「必须/优先」）语义不同：
 * 这里描述的是**学生自己**的掌握程度，取自其填写内容里的措辞。
 */
export type SkillProficiency = 'proficient' | 'basic' | 'unknown';

export const SKILL_PROFICIENCY_LABEL: Record<SkillProficiency, string> = {
  proficient: '熟练',
  basic: '了解',
  unknown: '待补充',
};

/** 学生技能项 */
export interface StudentSkillItem {
  name: string;
  /** 技能分类，如 编程语言 / 框架与中间件 */
  category?: string;
  /** 熟练度声明 */
  proficiency: SkillProficiency;
}

/** 学生证书项 */
export interface StudentCertItem {
  name: string;
}

/**
 * 学生画像的本地缓存键。
 * 能力画像页写入、人岗匹配页读取，必须共用同一个键，因此集中定义避免写错。
 */
export const STUDENT_PROFILE_STORAGE_KEY = 'studentAbilityProfile';

// ====================== 学生侧维度名 ======================

/**
 * 十维基准的键（key）与岗位侧完全共用，但**中文名在学生视角下需要个别调整**：
 * 岗位侧的「证书要求」是站在企业角度说的，学生这边应叫「证书资质」。
 * 其余维度名两侧通用，因此只做这一处覆盖，避免整份标签表分叉。
 */
const STUDENT_DIMENSION_LABEL_OVERRIDE: Partial<Record<AbilityDimensionKey, string>> = {
  certificate: '证书资质',
};

/** 取学生视角下的维度中文名 */
export const studentDimensionLabel = (key: AbilityDimensionKey): string =>
  STUDENT_DIMENSION_LABEL_OVERRIDE[key] ?? JOB_DIMENSIONS.find((d) => d.key === key)?.label ?? key;

// ====================== 学生录入的原始信息 ======================

/** 年级 */
export type GradeKey = 'freshman' | 'sophomore' | 'junior' | 'senior' | 'postgraduate';

export const GRADE_LABEL: Record<GradeKey, string> = {
  freshman: '大一',
  sophomore: '大二',
  junior: '大三',
  senior: '大四',
  postgraduate: '研究生',
};

export const GRADE_OPTIONS: GradeKey[] = [
  'freshman',
  'sophomore',
  'junior',
  'senior',
  'postgraduate',
];

/**
 * 学生提交的原始信息。
 * 字段均为文本，既支持手动录入，也支持后续「简历上传 → 后端抽取纯文本」的结果直接填充。
 */
export interface StudentProfileInput {
  student_id?: string;
  /** 专业 */
  major: string;
  /** 年级 */
  grade: GradeKey | '';
  /** 职业意向岗位，如 Java开发工程师 */
  target_job: string;
  /** 职业意向行业 */
  target_industry: string;
  /** 专业技能（自由文本，逗号/顿号/换行分隔） */
  skills_text: string;
  /** 证书资质 */
  certificates_text: string;
  /** 项目经历 */
  projects_text: string;
  /** 实习/实践经历 */
  internships_text: string;
  /** 获奖情况 */
  awards_text: string;
  /** 成绩/GPA/排名（选填） */
  gpa: string;
  /** 自我评价与其他补充（选填） */
  self_evaluation: string;
  /** 简历原文（预留：简历上传后由后端抽取的纯文本，会自动并入解析语料） */
  resume_text?: string;
}

// ====================== 完整度评分 ======================

/** 参与完整度计算的字段 */
export type CompletenessField =
  | 'major'
  | 'grade'
  | 'target_job'
  | 'skills_text'
  | 'certificates_text'
  | 'projects_text'
  | 'internships_text'
  | 'awards_text'
  | 'gpa'
  | 'self_evaluation';

/** 各字段在完整度中的权重，合计 100 */
export const COMPLETENESS_WEIGHTS: Record<CompletenessField, number> = {
  major: 12,
  grade: 4,
  target_job: 10,
  skills_text: 20,
  certificates_text: 10,
  projects_text: 16,
  internships_text: 16,
  awards_text: 6,
  gpa: 3,
  self_evaluation: 3,
};

/** 字段中文名（用于「还缺什么」提示） */
export const COMPLETENESS_FIELD_LABEL: Record<CompletenessField, string> = {
  major: '专业',
  grade: '年级',
  target_job: '职业意向岗位',
  skills_text: '专业技能',
  certificates_text: '证书资质',
  projects_text: '项目经历',
  internships_text: '实习/实践经历',
  awards_text: '获奖情况',
  gpa: '成绩/GPA',
  self_evaluation: '自我评价',
};

/**
 * 完整度字段的计算顺序。
 * 显式声明顺序而不是依赖 Object.keys，避免不同 JS 引擎的键序差异导致
 * 明细列表顺序不稳定。
 */
export const COMPLETENESS_FIELDS_ORDER: CompletenessField[] = [
  'major',
  'grade',
  'target_job',
  'skills_text',
  'certificates_text',
  'projects_text',
  'internships_text',
  'awards_text',
  'gpa',
  'self_evaluation',
];

/** 文本字段被视为「填写充分」的最小长度（低于此长度只算半分） */
export const FIELD_SUFFICIENT_LENGTH = 8;

/** 完整度明细 */
export interface CompletenessDetail {
  field: CompletenessField;
  label: string;
  filled: boolean;
  /** 该字段得分 0-1（0 未填，0.5 内容过短，1 填写充分） */
  ratio: number;
  /** 该字段贡献的分数 */
  score: number;
  /** 该字段满分 */
  fullScore: number;
}

// ====================== 徽章 ======================

/** 徽章定义 */
export interface BadgeDefinition {
  id: string;
  /** 徽章名，如「学习达人」 */
  name: string;
  /** 图标（emoji，避免额外图片资源） */
  icon: string;
  /** 解锁条件说明 */
  condition: string;
  /** 由单个维度驱动时填写 */
  dimension?: AbilityDimensionKey;
  /** 单维度解锁阈值 */
  threshold?: number;
  /** 需要多个维度同时达标时填写 */
  allDimensionsAbove?: number;
}

/**
 * 职业徽章墙规则（对齐计划书示例：「学习达人」「实践能手」等）。
 * 判定时取「维度分值 >= 阈值」即点亮。
 */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'skill_master',
    name: '技能大师',
    icon: '⚙️',
    condition: '专业技能 ≥ 85',
    dimension: 'professional_skill',
    threshold: 85,
  },
  {
    id: 'certified',
    name: '持证上岗',
    icon: '📜',
    condition: '证书资质 ≥ 75',
    dimension: 'certificate',
    threshold: 75,
  },
  {
    id: 'learning_star',
    name: '学习达人',
    icon: '📚',
    condition: '学习能力 ≥ 80',
    dimension: 'learning',
    threshold: 80,
  },
  {
    id: 'practice_expert',
    name: '实践能手',
    icon: '🛠️',
    condition: '实习能力 ≥ 80',
    dimension: 'internship',
    threshold: 80,
  },
  {
    id: 'team_star',
    name: '团队之星',
    icon: '🤝',
    condition: '团队协作 ≥ 80',
    dimension: 'teamwork',
    threshold: 80,
  },
  {
    id: 'communicator',
    name: '沟通高手',
    icon: '💬',
    condition: '沟通能力 ≥ 80',
    dimension: 'communication',
    threshold: 80,
  },
  {
    id: 'stress_warrior',
    name: '抗压战士',
    icon: '🛡️',
    condition: '抗压能力 ≥ 80',
    dimension: 'stress_resistance',
    threshold: 80,
  },
  {
    id: 'innovator',
    name: '创新先锋',
    icon: '💡',
    condition: '创新能力 ≥ 80',
    dimension: 'innovation',
    threshold: 80,
  },
  {
    id: 'logician',
    name: '逻辑思维者',
    icon: '🧩',
    condition: '逻辑思维 ≥ 80',
    dimension: 'logical_thinking',
    threshold: 80,
  },
  {
    id: 'industry_watcher',
    name: '行业观察家',
    icon: '🔭',
    condition: '行业认知 ≥ 80',
    dimension: 'industry_cognition',
    threshold: 80,
  },
  {
    id: 'all_rounder',
    name: '全能选手',
    icon: '🏅',
    condition: '十项维度全部 ≥ 70',
    allDimensionsAbove: 70,
  },
  {
    id: 'hexagon_warrior',
    name: '六边形战士',
    icon: '💎',
    condition: '十项维度全部 ≥ 80',
    allDimensionsAbove: 80,
  },
];

/** 徽章（含解锁状态） */
export interface StudentBadge {
  id: string;
  name: string;
  icon: string;
  condition: string;
  unlocked: boolean;
  /** 解锁进度 0-1（用于未点亮时展示进度） */
  progress: number;
  /** 关联维度（无则为全局徽章） */
  dimension?: AbilityDimensionKey;
}

// ====================== 学生维度 ======================

export interface StudentDimension {
  key: AbilityDimensionKey;
  label: string;
  /** 0-100，越高表示该能力越强（与岗位侧「要求强度」方向相反） */
  score: number;
  level: AbilityLevel;
  /** 解析置信度 0-1 */
  confidence: number;
  source: ParseSource;
  /** 解析依据片段，可追溯 */
  evidence: string[];
  /** 仅「专业技能」维度：识别出的技能清单 */
  skills?: StudentSkillItem[];
  /** 仅「证书要求」维度：识别出的证书清单 */
  certificates?: StudentCertItem[];
}

// ====================== 学生画像主体 ======================

export interface StudentProfile {
  student_id: string;
  major: string;
  grade: GradeKey | '';
  grade_label: string;
  target_job: string;
  target_industry: string;

  /** 固定 10 项维度 */
  dimensions: StudentDimension[];

  /** 信息完整度评分 0-100 */
  completeness: number;
  /** 完整度明细 */
  completeness_detail: CompletenessDetail[];
  /** 尚未填写的字段中文名（用于引导补全） */
  missing_fields: string[];

  /** 综合就业竞争力评分 0-100 */
  competitiveness: number;
  competitiveness_level: AbilityLevel;

  /** 优势维度（分值最高的前 3） */
  strengths: AbilityDimensionKey[];
  /** 短板维度（分值最低的前 3） */
  weaknesses: AbilityDimensionKey[];

  /** 徽章墙 */
  badges: StudentBadge[];

  /** 画像总述 */
  summary: string;
  parse_method: ParseSource;
  confidence: number;
  parsed_at: string;
}

// ====================== 归一化 / 校验 ======================

/** 归一化后端返回的学生画像：补齐缺失十维、重算派生字段 */
export const normalizeStudentProfile = (raw: Partial<StudentProfile>): StudentProfile => {
  const rawMap = new Map<AbilityDimensionKey, StudentDimension>();
  (raw.dimensions ?? []).forEach((d) => {
    if (d && d.key) rawMap.set(d.key, d as StudentDimension);
  });

  const dimensions: StudentDimension[] = JOB_DIMENSIONS.map((meta) => {
    const found = rawMap.get(meta.key);
    const score =
      typeof found?.score === 'number' && !Number.isNaN(found.score)
        ? Math.max(0, Math.min(100, found.score))
        : found?.level
          ? levelToScore(found.level)
          : levelToScore('medium');

    return {
      key: meta.key,
      label: studentDimensionLabel(meta.key),
      score,
      level: found?.level ?? scoreToLevel(score),
      confidence: typeof found?.confidence === 'number' ? found.confidence : 0.5,
      source: found?.source ?? raw.parse_method ?? 'rule',
      evidence: found?.evidence ?? [],
      skills: meta.key === 'professional_skill' ? (found?.skills ?? []) : undefined,
      certificates: meta.key === 'certificate' ? (found?.certificates ?? []) : undefined,
    };
  });

  const grade = raw.grade ?? '';

  return {
    student_id: raw.student_id ?? '',
    major: raw.major ?? '',
    grade,
    grade_label: grade ? (GRADE_LABEL[grade as GradeKey] ?? '') : '',
    target_job: raw.target_job ?? '',
    target_industry: raw.target_industry ?? '',
    dimensions,
    completeness: typeof raw.completeness === 'number' ? raw.completeness : 0,
    completeness_detail: raw.completeness_detail ?? [],
    missing_fields: raw.missing_fields ?? [],
    competitiveness: typeof raw.competitiveness === 'number' ? raw.competitiveness : 0,
    competitiveness_level: raw.competitiveness_level ?? scoreToLevel(raw.competitiveness ?? 0),
    strengths: raw.strengths ?? [],
    weaknesses: raw.weaknesses ?? [],
    badges: raw.badges ?? [],
    summary: raw.summary ?? '',
    parse_method: raw.parse_method ?? 'rule',
    confidence:
      typeof raw.confidence === 'number'
        ? raw.confidence
        : Number(
            (
              dimensions.reduce((sum, d) => sum + d.confidence, 0) / (dimensions.length || 1)
            ).toFixed(2)
          ),
    parsed_at: raw.parsed_at ?? new Date().toISOString(),
  };
};

/** 校验后端返回的学生画像是否可用（必须含全部十维且分值合法） */
export const isValidStudentProfile = (profile: unknown): profile is StudentProfile => {
  if (!profile || typeof profile !== 'object') return false;
  const dims = (profile as StudentProfile).dimensions;
  if (!Array.isArray(dims)) return false;
  return JOB_DIMENSION_KEYS.every((key) =>
    dims.some((d) => d?.key === key && typeof d.score === 'number' && !Number.isNaN(d.score))
  );
};

/** 供界面复用的等级中文名 */
export { LEVEL_LABEL };
