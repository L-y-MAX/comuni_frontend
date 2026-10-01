/**
 * 岗位画像（Job Profile）数据模型
 *
 * 对应计划书《职途智行》核心功能板块(1)「就业岗位要求画像构建」：
 * 从专业技能、证书要求、创新能力、学习能力、抗压能力、沟通能力、
 * 实习能力、团队协作、逻辑思维、行业认知 十大核心维度对岗位进行定义，
 * 形成统一、可对比、可评估的岗位能力基准。
 *
 * 设计要点：
 * 1. 十个维度固定存在、顺序固定，便于「学生能力画像」按同一基准对齐（后续人岗匹配依赖此约定）。
 * 2. 每个维度同时给出 score(0-100) 与 level(高/中/低)：
 *    - score 用于后续人岗匹配的加权计算
 *    - level 用于前端直观展示（以及对齐计划书示例中的「中/高」表述）
 * 3. 每个维度携带 weight（权重，10 项合计为 1）与 confidence（解析置信度 0-1）。
 * 4. 专业技能、证书要求两个维度额外携带结构化清单（必须/优先）。
 * 5. source 字段区分该维度来自「千问大模型解析」还是「本地规则兜底解析」，
 *    便于后端接口就绪前后平滑过渡，也便于界面向用户如实说明数据来源。
 */

// ====================== 十大维度定义 ======================

/** 十大核心维度标识 */
export type JobDimensionKey =
  | 'professional_skill' // 专业技能
  | 'certificate' // 证书要求
  | 'innovation' // 创新能力
  | 'learning' // 学习能力
  | 'stress_resistance' // 抗压能力
  | 'communication' // 沟通能力
  | 'internship' // 实习能力
  | 'teamwork' // 团队协作
  | 'logical_thinking' // 逻辑思维
  | 'industry_cognition'; // 行业认知

/** 能力等级（对齐计划书示例中的「高/中/低」表述） */
export type AbilityLevel = 'high' | 'medium' | 'low';

/** 解析来源 */
export type ParseSource = 'qwen' | 'rule';

/** 要求强度：必须 / 优先 */
export type RequirementStrength = 'must' | 'preferred';

/** 维度元定义 */
export interface JobDimensionMeta {
  key: JobDimensionKey;
  /** 中文维度名 */
  label: string;
  /** 默认权重，10 项合计为 1 */
  defaultWeight: number;
  /** 维度说明（用于界面提示） */
  description: string;
}

/**
 * 十大维度元数据（顺序即界面展示顺序）
 * 权重来源：结合校招场景对「专业技能 / 学习能力 / 实习能力」赋权较高，
 * 「行业认知」等长线维度赋权较低；后端可下发覆盖值。
 */
export const JOB_DIMENSIONS: readonly JobDimensionMeta[] = [
  {
    key: 'professional_skill',
    label: '专业技能',
    defaultWeight: 0.2,
    description: '岗位要求的编程语言、框架、工具、数据库等硬技能',
  },
  {
    key: 'certificate',
    label: '证书要求',
    defaultWeight: 0.08,
    description: '岗位明确要求或优先考虑的证书资质',
  },
  {
    key: 'innovation',
    label: '创新能力',
    defaultWeight: 0.08,
    description: '方案设计、技术改进、创意产出的要求程度',
  },
  {
    key: 'learning',
    label: '学习能力',
    defaultWeight: 0.12,
    description: '快速上手新技术、持续自主学习的要求程度',
  },
  {
    key: 'stress_resistance',
    label: '抗压能力',
    defaultWeight: 0.1,
    description: '面对高强度节奏、交付压力、加班的承受要求',
  },
  {
    key: 'communication',
    label: '沟通能力',
    defaultWeight: 0.1,
    description: '跨部门协作、需求表达、客户对接的沟通要求',
  },
  {
    key: 'internship',
    label: '实习能力',
    defaultWeight: 0.12,
    description: '相关实习、实践、项目落地经验的要求程度',
  },
  {
    key: 'teamwork',
    label: '团队协作',
    defaultWeight: 0.08,
    description: '团队配合、集体目标协同的要求程度',
  },
  {
    key: 'logical_thinking',
    label: '逻辑思维',
    defaultWeight: 0.07,
    description: '问题拆解、数据分析、条理严谨程度的要求',
  },
  {
    key: 'industry_cognition',
    label: '行业认知',
    defaultWeight: 0.05,
    description: '对所属行业、产业政策、市场趋势的理解要求',
  },
] as const;

/** 十大维度 key 的固定顺序数组 */
export const JOB_DIMENSION_KEYS: readonly JobDimensionKey[] = JOB_DIMENSIONS.map((d) => d.key);

/**
 * 语义化别名：这十个维度是「岗位要求」与「学生能力」共用的同一套基准，
 * 学生能力画像（@/types/studentProfile）通过此别名引用，避免出现
 * 「学生画像里出现 JobXxx 命名」的别扭写法。
 *
 * 注意两侧分值方向相反：
 *   - 岗位侧分值高 = 该岗位对这一维度的要求高（门槛高）
 *   - 学生侧分值高 = 该学生在这一维度上能力强
 * 后续人岗匹配需要同时用到这两层语义。
 */
export type AbilityDimensionKey = JobDimensionKey;

/** level → 默认分值映射（当后端只给等级、未给分值时使用） */
export const LEVEL_TO_SCORE: Record<AbilityLevel, number> = {
  high: 85,
  medium: 65,
  low: 45,
};

/** 等级中文 label */
export const LEVEL_LABEL: Record<AbilityLevel, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

/** 解析来源中文 label */
export const PARSE_SOURCE_LABEL: Record<ParseSource, string> = {
  qwen: '千问大模型解析',
  rule: '本地规则解析',
};

/** 分值 → 等级 */
export const scoreToLevel = (score: number): AbilityLevel => {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
};

/** 等级 → 分值 */
export const levelToScore = (level: AbilityLevel): number => LEVEL_TO_SCORE[level] ?? 60;

/** 按 key 取维度元数据 */
export const getDimensionMeta = (key: JobDimensionKey): JobDimensionMeta | undefined =>
  JOB_DIMENSIONS.find((d) => d.key === key);

// ====================== 维度内的结构化明细 ======================

/** 技能项（仅「专业技能」维度使用） */
export interface JobSkillItem {
  /** 技能名，如 Java、SpringBoot、MySQL */
  name: string;
  /** 要求强度 */
  requirement: RequirementStrength;
  /** 技能分类，如 编程语言 / 框架 / 数据库 / 工具 */
  category?: string;
}

/** 证书项（仅「证书要求」维度使用） */
export interface JobCertItem {
  /** 证书名，如 计算机二级、英语四级 */
  name: string;
  /** 要求强度 */
  requirement: RequirementStrength;
}

// ====================== 单个维度 ======================

export interface JobDimension {
  key: JobDimensionKey;
  /** 中文维度名（冗余存储，便于离线缓存后直接渲染） */
  label: string;
  /** 0-100 归一化分值，供人岗匹配加权计算 */
  score: number;
  /** 高 / 中 / 低 */
  level: AbilityLevel;
  /** 权重，10 项合计为 1 */
  weight: number;
  /** 解析置信度 0-1，本地规则兜底时通常偏低 */
  confidence: number;
  /** 该维度的解析来源 */
  source: ParseSource;
  /** 从原始招聘文本中抽取的证据片段，保证结论可追溯 */
  evidence: string[];
  /** 仅「专业技能」维度：技能清单 */
  skills?: JobSkillItem[];
  /** 仅「证书要求」维度：证书清单 */
  certificates?: JobCertItem[];
}

// ====================== 岗位画像主体 ======================

export interface JobProfile {
  /** 岗位名称 */
  job_name: string;
  /** 企业名称 */
  enterprise_name: string;
  /** 所属行业 */
  industry: string;
  /** 招聘专业（拆分为数组） */
  recruit_major: string[];
  /** 月薪范围（原始字符串，如 6000-9000） */
  salary_range: string;
  /** 招聘人数（原始字符串） */
  recruit_number: string;
  /** 来源招聘记录的信用代码（对应 recruitment.credit_code） */
  recruitment_id: string;
  /** 固定 10 项的维度画像 */
  dimensions: JobDimension[];
  /** 画像总述（一段话总结该岗位的能力侧重） */
  summary: string;
  /** 能力侧重标签，如 ['专业技能', '学习能力'] */
  focus_dimensions: JobDimensionKey[];
  /** 垂直晋升路径（为后续「岗位垂直晋升图谱」预留） */
  promotion_path: string[];
  /** 整体解析来源 */
  parse_method: ParseSource;
  /** 整体解析置信度 0-1 */
  confidence: number;
  /** 解析时间 ISO 字符串 */
  parsed_at: string;
}

// ====================== 接口契约（异步任务模式） ======================

/**
 * 千问结构化解析任务的请求载荷。
 *
 * 沿用现有 AI 对话的异步任务模式：
 *   POST /api/v1/employment/job-profile/parse/task/   → 202 { task_id }
 *   GET  /api/v1/employment/job-profile/parse/result/?task_id=xxx
 *        → { status: 'PENDING' | 'SUCCESS' | 'FAILURE', data?: { profile }, error?: string }
 */
export interface JobProfileParsePayload {
  /** 来源招聘记录信用代码，用于后端缓存与去重 */
  recruitment_id: string;
  job_name: string;
  enterprise_name: string;
  industry: string;
  recruit_major: string;
  monthly_salary: string;
  recruit_number: string;
  /** 企业简介，作为解析岗位软性要求的重要上下文 */
  enterprise_intro: string;
  /** 期望输出的维度 key，固定为十大维度 */
  dimensions: JobDimensionKey[];
}

/** 异步任务状态 */
export type TaskStatus = 'PENDING' | 'SUCCESS' | 'FAILURE';

/** 任务创建响应 */
export interface JobProfileTaskCreated {
  task_id: string;
}

/** 任务结果响应 */
export interface JobProfileTaskResult {
  status: TaskStatus;
  data?: {
    profile?: JobProfile;
  };
  error?: string;
}

// ====================== 生成结果（供页面直接消费） ======================

/** 生成入口的返回结构 */
export interface JobProfileGenerateResult {
  profile: JobProfile;
  /** 实际生效的解析方式 */
  method: ParseSource;
  /** 是否发生了降级（千问不可用 → 本地规则兜底） */
  degraded: boolean;
  /** 降级原因，便于界面提示与排查 */
  degradedReason?: string;
}

// ====================== 归一化 / 校验工具 ======================

/**
 * 归一化后端返回的画像：补齐缺失的十个维度、重算权重归一化。
 * 后端字段可能不全（例如遗漏某个维度），此处保证界面前提成立。
 */
export const normalizeJobProfile = (raw: Partial<JobProfile>): JobProfile => {
  const rawMap = new Map<JobDimensionKey, JobDimension>();
  (raw.dimensions ?? []).forEach((d) => {
    if (d && d.key) rawMap.set(d.key, d as JobDimension);
  });

  const dimensions: JobDimension[] = JOB_DIMENSIONS.map((meta) => {
    const found = rawMap.get(meta.key);
    const score =
      typeof found?.score === 'number' && !Number.isNaN(found.score)
        ? Math.max(0, Math.min(100, found.score))
        : found?.level
          ? levelToScore(found.level)
          : levelToScore('medium');

    return {
      key: meta.key,
      label: meta.label,
      score,
      level: found?.level ?? scoreToLevel(score),
      weight: typeof found?.weight === 'number' ? found.weight : meta.defaultWeight,
      confidence: typeof found?.confidence === 'number' ? found.confidence : 0.5,
      source: found?.source ?? raw.parse_method ?? 'rule',
      evidence: found?.evidence ?? [],
      skills: meta.key === 'professional_skill' ? (found?.skills ?? []) : undefined,
      certificates: meta.key === 'certificate' ? (found?.certificates ?? []) : undefined,
    };
  });

  // 权重归一化，保证合计为 1
  const weightSum = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (weightSum > 0 && Math.abs(weightSum - 1) > 0.001) {
    dimensions.forEach((d) => {
      d.weight = Number((d.weight / weightSum).toFixed(4));
    });
  }

  const parseMethod: ParseSource = raw.parse_method ?? 'rule';

  return {
    job_name: raw.job_name ?? '未知岗位',
    enterprise_name: raw.enterprise_name ?? '',
    industry: raw.industry ?? '',
    recruit_major: raw.recruit_major ?? [],
    salary_range: raw.salary_range ?? '',
    recruit_number: raw.recruit_number ?? '',
    recruitment_id: raw.recruitment_id ?? '',
    dimensions,
    summary: raw.summary ?? '',
    focus_dimensions: raw.focus_dimensions ?? [],
    promotion_path: raw.promotion_path ?? [],
    parse_method: parseMethod,
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

/**
 * 校验后端返回的画像是否可用。
 *
 * 判定标准：必须包含全部 10 个核心维度且分值合法。
 * 注意这里用「包含」而非「长度等于 10」——后端后续若新增维度（如「外语能力」），
 * 用长度相等会让整份合法画像被判为非法、白白降级到本地规则；
 * 多出来的维度由 normalizeJobProfile 原样保留即可。
 */
export const isValidJobProfile = (profile: unknown): profile is JobProfile => {
  if (!profile || typeof profile !== 'object') return false;
  const dims = (profile as JobProfile).dimensions;
  if (!Array.isArray(dims)) return false;
  return JOB_DIMENSION_KEYS.every((key) =>
    dims.some((d) => d?.key === key && typeof d.score === 'number' && !Number.isNaN(d.score))
  );
};
