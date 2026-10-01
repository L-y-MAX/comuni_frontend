/**
 * 人岗智能匹配 —— 匹配引擎（纯函数，无网络、无 UI 依赖）
 *
 * 输入：学生能力画像（StudentProfile） + 岗位画像（JobProfile）
 * 输出：匹配度、四大类目得分、十维差距、技能/证书缺口、提升建议
 *
 * ## 打分公式
 *
 * 1) 单维度达成度（fit）
 *      岗位要求 <= 55  →  视为「无硬性要求」，fit = 1（不比大小、也不扣分）
 *      否则            →  fit = clamp(学生分 / 岗位要求分, 0, 1)
 *    「超出要求」封顶为 1：匹配度衡量的是「够不够用」，不是「越强越好」。
 *
 * 2) 维度有效权重
 *      w = 十维基准权重 × 岗位侧置信度 × 学生侧置信度
 *    这样「岗位没写清楚」或「学生没填」的维度会自动降权，
 *    避免拿着不确定的数据给出确定的高分。
 *
 * 3) 类目得分 = 该类目内各维度 fit 的加权平均 × 100
 *   综合匹配度 = 四大类目得分的加权平均
 *
 * 4) 硬性缺口扣分
 *    岗位标为「必须」但学生未体现的技能，每项扣 3 分；证书每项扣 2 分，累计封顶 12 分。
 *    扣分理由：维度分是粗粒度的，而「必须掌握的技能缺失」是校招筛选的硬门槛，
 *    两者不应被合并成同一个信号。
 *
 * ## 已知局限（不夸大能力）
 *
 * 本引擎不做语义理解，完全依赖两侧画像的质量：
 *   - 两侧画像来自本地规则解析时，匹配度只能作为方向性参考；
 *   - 因此结果里带 confidence 字段，并在界面上如实标注。
 * 「匹配准确率 ≥85%」是目标值，需要真实标注数据回归验证后才能宣称，本实现不作保证。
 */

import {
  JOB_DIMENSIONS,
  type AbilityDimensionKey,
  type JobProfile,
} from '@/types/jobProfile';
import type { StudentProfile } from '@/types/studentProfile';
import {
  MATCH_CATEGORIES,
  MAX_SKILL_PENALTY,
  SATISFY_TOLERANCE,
  COVERAGE_SATISFY_THRESHOLD,
  INSUFFICIENT_INFO_CONFIDENCE,
  scoreToMatchLevel,
  MATCH_LEVEL_LABEL,
  type CertGap,
  type DimensionGap,
  type FitBasis,
  type MatchCategoryResult,
  type MatchResult,
  type SkillGap,
} from '@/types/jobMatch';

// ====================== 调参常量 ======================

/**
 * 「显著短板」的达成度阈值。
 *
 * 短板判定必须与达成度用同一把尺子。早先用的是分值差（gap > SIGNIFICANT_GAP），
 * 而达成度用的是技能覆盖率，两者会打架：
 * 某岗位要求专业技能 92、学生自己 97（分值差 -5，判不出短板），
 * 但学生一项要求技能都没有（覆盖率 0%），
 * 于是界面出现「专业技能达成度 0%」+「关键短板：（空）」+「建议：各项要求均已达成」。
 */
export const WEAK_DIM_FIT_THRESHOLD = 0.75;

/**
 * 核心技能门槛下限：专业技能达成度为 0 时，总评匹配度的上限。
 *
 * 为什么需要门槛：专业技能只占四个类目权重的一部分。
 * 一个「岗位要求的技能一项都不具备」的学生，仍会因为实践经历与综合素质都是满分
 * 而拿到 60 分上下的总分，被判成「基本匹配」——
 * 软件工程学生被机械设计工程师岗判 61% 就是这么来的。
 * 真实招聘里核心技能不达标，其余项再漂亮也不会算基本匹配。
 * 达成度 100% 时上限为 100，不产生任何约束。
 */
export const CORE_GATE_FLOOR = 30;

// ====================== 基础工具 ======================

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * 单维度达成度。
 * @param studentScore 学生能力分
 * @param requiredScore 岗位要求分
 */
export const calcDimensionFit = (studentScore: number, requiredScore: number): number => {
  // 岗位侧给不出有效要求（中性基准分及以下）时，不视为门槛
  if (requiredScore <= NO_REQUIREMENT_THRESHOLD) return 1;
  return clamp(studentScore / requiredScore, 0, 1);
};

/** 低于等于该值视为「岗位未提出有效要求」 */
export const NO_REQUIREMENT_THRESHOLD = 55;

// ====================== 技能 / 证书覆盖率 ======================

export interface CoverageResult {
  /** 加权覆盖率 0-1；-1 表示岗位未列出该项要求 */
  coverage: number;
  /** 「必须」类子集覆盖率 0-1；无必须项时为 1 */
  mustCoverage: number;
  /** 岗位共列出几项 */
  total: number;
  /** 学生已具备几项 */
  matched: number;
}

/**
 * 计算「岗位要求的技能/证书」在学生身上的覆盖率。
 *
 * 为什么专业技能与证书不能沿用分值比例：
 *   两个学生的专业技能分值可能都是 92（都掌握了 8 项技能），
 *   但一个学的是 Java 技术栈，另一个学的是新媒体运营——
 *   对同一个 Java 岗位，前者覆盖率 100%，后者覆盖率 0。
 *   只看分值比例会把后者也算成"专业技能基本达标"，这是错的。
 *   计划书示例同样是从「具体技能缺哪几项」展开的，说明这里要的就是技能集合的重合度。
 *
 * 「必须」类按 2 倍权重计入，让硬性要求的缺失对覆盖率影响更大。
 */
export const calcRequirementCoverage = (
  required: { name: string; requirement: 'must' | 'preferred' }[],
  possessed: Set<string>
): CoverageResult => {
  if (!required.length) {
    return { coverage: -1, mustCoverage: 1, total: 0, matched: 0 };
  }

  let weightedTotal = 0;
  let weightedMatched = 0;
  let mustTotal = 0;
  let mustMatched = 0;
  let matched = 0;

  required.forEach((item) => {
    const isMust = item.requirement === 'must';
    const w = isMust ? 2 : 1;
    const has = possessed.has(item.name.toLowerCase());

    weightedTotal += w;
    if (has) {
      weightedMatched += w;
      matched += 1;
    }
    if (isMust) {
      mustTotal += w;
      if (has) mustMatched += w;
    }
  });

  return {
    coverage: weightedTotal > 0 ? weightedMatched / weightedTotal : 0,
    mustCoverage: mustTotal > 0 ? mustMatched / mustTotal : 1,
    total: required.length,
    matched,
  };
};

// ====================== 提升建议模板 ======================

/** 十维各自的行动建议（生涯报告生成成长计划时复用，避免两份文案不一致） */
export const DIMENSION_ADVICE: Record<AbilityDimensionKey, string> = {
  professional_skill:
    '通过课程、认证或项目实战系统补齐岗位要求的硬技能，并在简历中用可量化的产出证明',
  certificate: '规划考证时间表，优先拿下岗位明确要求的证书',
  innovation:
    '在项目中主动记录你提出的改进方案与优化效果，沉淀成可讲述的创新案例',
  learning: '整理一份「新技术上手记录」，体现你快速学习并落地的完整过程',
  stress_resistance: '用「多任务并行、按时交付」的具体事例体现抗压能力，避免只写形容词',
  communication: '主动承担小组汇报、需求对接等角色，积累跨角色沟通的实例',
  internship: '尽快补充一段与目标岗位相关的实习或完整项目，这是校招最看重的一项',
  teamwork: '在项目经历中写明你的协作角色与团队成果，而不只是个人产出',
  logical_thinking: '练习用「背景—目标—方案—结果」的结构拆解问题，并在简历中体现',
  industry_cognition: '关注目标行业的政策与趋势，准备能体现行业理解的求职理由',
};

// ====================== 主匹配函数 ======================

/**
 * 计算学生与单个岗位的匹配结果。
 *
 * @param student 学生能力画像
 * @param job 岗位画像
 */
export const matchStudentToJob = (student: StudentProfile, job: JobProfile): MatchResult => {
  const studentDim = (key: AbilityDimensionKey) => student.dimensions.find((d) => d.key === key);
  const jobDim = (key: AbilityDimensionKey) => job.dimensions.find((d) => d.key === key);

  // ---------- 0. 先抽取技能 / 证书集合（专业技能与证书的达成度靠集合重合度算） ----------
  const jobSkills = jobDim('professional_skill')?.skills ?? [];
  const studentSkills = studentDim('professional_skill')?.skills ?? [];
  const studentSkillNames = new Set(studentSkills.map((s) => s.name.toLowerCase()));

  const jobCerts = jobDim('certificate')?.certificates ?? [];
  const studentCerts = studentDim('certificate')?.certificates ?? [];
  const studentCertNames = new Set(studentCerts.map((c) => c.name.toLowerCase()));

  const skillCoverage = calcRequirementCoverage(jobSkills, studentSkillNames);
  const certCoverage = calcRequirementCoverage(jobCerts, studentCertNames);

  // ---------- 1. 十维差距 ----------
  const gaps: DimensionGap[] = JOB_DIMENSIONS.map((meta) => {
    const s = studentDim(meta.key);
    const j = jobDim(meta.key);

    const studentScore = s?.score ?? 0;
    const requiredScore = j?.score ?? 0;

    // 岗位是否列出了具体技能/证书条目（有清单就说明这一项有实打实的要求，
    // 即使维度分不高也不能当成"没要求"）
    const hasExplicitList =
      (meta.key === 'professional_skill' && skillCoverage.coverage >= 0) ||
      (meta.key === 'certificate' && certCoverage.coverage >= 0);

    // 岗位对这一维度是否提出了有效要求
    const noRequirement = !hasExplicitList && requiredScore <= NO_REQUIREMENT_THRESHOLD;

    // 专业技能 / 证书资质：用「岗位要求的集合里学生覆盖了多少」来衡量，
    // 而不是比两边的分数——分数只说明"有多少"，不说明"对不对口"。
    // 岗位没列出具体条目时，退回分值比例。
    let fit: number;
    let basis: FitBasis = 'score';
    if (meta.key === 'professional_skill' && skillCoverage.coverage >= 0) {
      fit = skillCoverage.coverage;
      basis = 'coverage';
    } else if (meta.key === 'certificate' && certCoverage.coverage >= 0) {
      fit = certCoverage.coverage;
      basis = 'coverage';
    } else {
      fit = calcDimensionFit(studentScore, requiredScore);
    }

    // 有效权重：基准权重 × 双方置信度
    const studentConf = s?.confidence ?? 0.5;
    const jobConf = j?.confidence ?? 0.5;

    // 关键：岗位没提要求时，这一维度**不能算满分**。
    // 早先的实现在这种情况下给 fit=1 且保留全权重，
    // 结果是"要求写得越少的岗位越容易被匹配上"——
    // 一个软件工程学生会把机械设计岗排到 Java 岗前面。
    // 正确做法是：没要求 = 这条维度不携带任何匹配信息，直接不参与加权。
    const effectiveWeight = noRequirement
      ? 0
      : Number((meta.defaultWeight * studentConf * jobConf).toFixed(6));

    const gap = requiredScore - studentScore;

    // 达标判定必须和 fit 用同一把尺子，否则会出现
    // 「类目得分 0 分」却在表格里写「已达标」的矛盾
    const rawSatisfied =
      basis === 'coverage'
        ? fit >= COVERAGE_SATISFY_THRESHOLD
        : studentScore >= requiredScore - SATISFY_TOLERANCE;

    // 岗位未提要求的维度必须回到「中性」。
    // calcDimensionFit 在 requiredScore 低于阈值时返回 1，于是这类维度
    // 变成 fitPercent=100%、satisfied=true，界面上就是
    // 「覆盖率 100%（岗位未提要求）」配一条绿色满格进度条，看起来像"已达标"，
    // 与它「不参与评分」的定位自相矛盾。
    // 达成度归零、达标标记去除，改由 noRequirement 单独表达"不适用"。
    const finalFit = noRequirement ? 0 : fit;
    const satisfied = noRequirement ? false : rawSatisfied;

    return {
      key: meta.key,
      label: s?.label ?? meta.label,
      studentScore,
      requiredScore,
      gap,
      fit: Number(finalFit.toFixed(4)),
      basis,
      fitPercent: Math.round(clamp(finalFit, 0, 1) * 100),
      satisfied,
      noRequirement,
      insufficientInfo: studentConf < INSUFFICIENT_INFO_CONFIDENCE,
      effectiveWeight,
    };
  });

  // 真正参与打分的维度（剔除了岗位未提要求的项）
  const activeGaps = gaps.filter((g) => g.effectiveWeight > 0);

  // ---------- 2. 四大类目得分 ----------
  const categories: MatchCategoryResult[] = MATCH_CATEGORIES.map((cat) => {
    const inCat = gaps.filter((g) => cat.dimensions.includes(g.key));
    const active = inCat.filter((g) => g.effectiveWeight > 0);
    const wSum = active.reduce((sum, g) => sum + g.effectiveWeight, 0);

    // 类目下所有维度岗位都没提要求 → 该类目不参与总评（active=false）
    if (!active.length || wSum <= 0) {
      return {
        key: cat.key,
        label: cat.label,
        score: 0,
        weight: cat.weight,
        description: cat.description,
        active: false,
      };
    }

    const score = (active.reduce((sum, g) => sum + g.fit * g.effectiveWeight, 0) / wSum) * 100;

    return {
      key: cat.key,
      label: cat.label,
      score: Math.round(clamp(score, 0, 100)),
      weight: cat.weight,
      description: cat.description,
      active: true,
    };
  });

  // ---------- 3. 基础综合分 ----------
  // 只在「有要求的类目」之间按权重归一化，避免整块缺席的类目拉低总分
  const activeCats = categories.filter((c) => c.active);
  const activeCatWeight = activeCats.reduce((sum, c) => sum + c.weight, 0);

  const baseScore = activeCatWeight > 0
    ? activeCats.reduce((sum, c) => sum + c.score * c.weight, 0) / activeCatWeight
    : 0;

  // ---------- 4. 技能 / 证书缺口（集合已在第 0 步抽取） ----------
  const skillGaps: SkillGap[] = jobSkills
    .map((js) => {
      const possessed = studentSkillNames.has(js.name.toLowerCase());
      const matched = studentSkills.find((ss) => ss.name.toLowerCase() === js.name.toLowerCase());
      return {
        name: js.name,
        requirement: js.requirement,
        possessed,
        studentProficiency: matched?.proficiency,
      };
    })
    // 只关心缺口，已具备的不列出
    .filter((g) => !g.possessed);

  const certGaps: CertGap[] = jobCerts
    .map((jc) => ({
      name: jc.name,
      requirement: jc.requirement,
      possessed: studentCertNames.has(jc.name.toLowerCase()),
    }))
    .filter((g) => !g.possessed);

  const missingMustSkills = skillGaps.filter((g) => g.requirement === 'must').length;
  const missingCerts = certGaps.length;

  const penalty = Math.min(
    MAX_SKILL_PENALTY,
    missingMustSkills * 3 + missingCerts * 2
  );

  const rawScore = Math.round(clamp(baseScore - penalty, 0, 100));

  // ---------- 4.5 核心技能门槛 ----------
  // 只在「岗位确实列出了技能要求」且「学生侧信息足够」时生效：
  // 学生没写技能（信息不足）不等于学生不会技能，那种情况不能压分。
  const profGap = gaps.find((g) => g.key === 'professional_skill');
  let matchScore = rawScore;
  let gateNote = '';

  if (
    profGap &&
    profGap.basis === 'coverage' &&
    !profGap.noRequirement &&
    !profGap.insufficientInfo
  ) {
    const cap = Math.round(CORE_GATE_FLOOR + (100 - CORE_GATE_FLOOR) * profGap.fit);
    if (cap < rawScore) {
      matchScore = cap;
      gateNote =
        `核心技能门槛：岗位要求的 ${skillCoverage.total} 项技能中你只覆盖了 ${profGap.fitPercent}%，` +
        `核心能力未达标，总评从 ${rawScore}% 封顶到 ${cap}%`;
    }
  }

  const matchLevel = scoreToMatchLevel(matchScore);

  // ---------- 5. 关键短板 ----------
  const criticalGaps: string[] = [];

  // 5a. 门槛封顶说明（最重要，放最前，避免用户看到分数骤降却不知道原因）
  if (gateNote) criticalGaps.push(gateNote);

  // 5a. 硬技能缺失（优先级最高）
  const mustMissing = skillGaps.filter((g) => g.requirement === 'must').map((g) => g.name);
  if (mustMissing.length) {
    criticalGaps.push(`${mustMissing.join('、')} 等 ${mustMissing.length} 项硬技能未体现`);
  }

  // 5b. 证书缺失
  if (missingCerts) {
    criticalGaps.push(`${certGaps.map((c) => c.name).join('、')} 证书未获取`);
  }

  // 5c. 显著偏低的维度（按「未达成程度 × 有效权重」排序，取前 3）
  // 判定口径与达成度一致，不再用分值差（见文件顶部 WEAK_DIM_FIT_THRESHOLD 的说明）。
  const weakDims = gaps
    .filter(
      (g) =>
        !g.noRequirement &&
        !g.satisfied &&
        g.fit < WEAK_DIM_FIT_THRESHOLD &&
        g.effectiveWeight > 0
    )
    .sort((a, b) => (1 - b.fit) * b.effectiveWeight - (1 - a.fit) * a.effectiveWeight)
    .slice(0, 3);

  if (weakDims.length) {
    criticalGaps.push(
      weakDims
        .map((g) =>
          g.basis === 'coverage'
            ? `${g.label}（岗位要求条目覆盖率仅 ${g.fitPercent}%）`
            : `${g.label}（要求 ${g.requiredScore}，你 ${g.studentScore}）`
        )
        .join('；')
    );
  }

  // ---------- 6. 提升建议 ----------
  const suggestions: string[] = [];

  const mustSkillGaps = skillGaps.filter((g) => g.requirement === 'must');

  mustSkillGaps.slice(0, 3).forEach((g) => {
    suggestions.push(
      `补齐「${g.name}」：岗位将其列为硬性要求，建议通过项目实战或系统课程掌握，并在简历中体现产出`
    );
  });

  // 岗位只写「优先」项时（一条「必须」都没有），上面的分支一条建议都不产生，
  // 而核心维度达成度可能依然很低，于是界面会是「达成度很低」+「各项要求均已达成」。
  // 这类情况下把缺口一并提示出来，并如实说明它是「优先要求」而不是硬门槛。
  const coreDimFailed = gaps.some(
    (g) =>
      (g.key === 'professional_skill' || g.key === 'certificate') &&
      !g.noRequirement &&
      !g.satisfied
  );
  if (!mustSkillGaps.length && coreDimFailed) {
    skillGaps.slice(0, 3).forEach((g) => {
      suggestions.push(`补齐「${g.name}」：岗位将其列为优先要求，是当前提高匹配度性价比最高的一项`);
    });
  }

  certGaps.slice(0, 2).forEach((c) => {
    suggestions.push(`考取「${c.name}」：该岗位将其列为要求，建议纳入本学期考证计划`);
  });

  weakDims.forEach((g) => {
    suggestions.push(`${g.label}：${DIMENSION_ADVICE[g.key]}`);
  });

  if (!suggestions.length) {
    suggestions.push('当前各项要求均已达成，建议把相关经历补充得更具体，突出可量化的成果');
  }

  // ---------- 7. 置信度 ----------
  // 用两侧画像自身的解析置信度，反映"这份匹配结论建立在多可靠的数据上"
  const confidence = Number(((student.confidence + job.confidence) / 2).toFixed(2));

  // ---------- 8. 摘要 ----------
  // 达标统计只看「岗位确实提了要求」的维度，否则分母里混入无关维度会误导用户
  const satisfiedCount = activeGaps.filter((g) => g.satisfied).length;
  const summary = buildSummary({
    jobName: job.job_name,
    enterpriseName: job.enterprise_name,
    matchScore,
    satisfiedCount,
    totalCount: activeGaps.length,
    mustMissing,
    missingCerts,
    weakDims,
    matchLevel,
  });

  return {
    jobId: job.recruitment_id || job.job_name,
    jobName: job.job_name,
    enterpriseName: job.enterprise_name,
    industry: job.industry,
    matchScore,
    matchLevel,
    matchLevelLabel: MATCH_LEVEL_LABEL[matchLevel],
    categories,
    gaps,
    satisfiedCount,
    totalCount: activeGaps.length,
    skillGaps,
    certGaps,
    missingMustSkills,
    criticalGaps,
    suggestions,
    confidence,
    summary,
    isRuleBased: student.parse_method === 'rule' || job.parse_method === 'rule',
  };
};

// ====================== 摘要生成 ======================

interface SummaryInput {
  jobName: string;
  enterpriseName: string;
  matchScore: number;
  satisfiedCount: number;
  totalCount: number;
  mustMissing: string[];
  missingCerts: number;
  weakDims: DimensionGap[];
  matchLevel: ReturnType<typeof scoreToMatchLevel>;
}

const buildSummary = (input: SummaryInput): string => {
  const {
    jobName,
    enterpriseName,
    matchScore,
    satisfiedCount,
    totalCount,
    mustMissing,
    missingCerts,
    weakDims,
    matchLevel,
  } = input;

  const prefix = enterpriseName ? `${enterpriseName}的` : '';

  const levelText: Record<string, string> = {
    excellent: '整体匹配度很高，建议尽快投递',
    good: '整体较为匹配，补齐短板后竞争力会明显提升',
    fair: '基本满足要求，但存在需要补强的项',
    low: '当前差距较大，建议先按建议补齐再投递',
  };

  const parts: string[] = [
    `你与${prefix}${jobName}岗位的综合匹配度为 ${matchScore}%，${levelText[matchLevel] ?? ''}。`,
    `十大维度中已有 ${satisfiedCount}/${totalCount} 项达到岗位要求。`,
  ];

  const shortfalls: string[] = [];
  if (mustMissing.length) shortfalls.push(`硬技能「${mustMissing.join('、')}」尚未体现`);
  if (missingCerts) shortfalls.push(`${missingCerts} 项要求证书未获取`);
  if (weakDims.length) {
    shortfalls.push(`${weakDims.map((d) => d.label).join('、')}差距较大`);
  }

  if (shortfalls.length) {
    parts.push(`主要不足：${shortfalls.join('；')}。`);
  } else {
    parts.push('未发现明显短板。');
  }

  return parts.join('');
};

// ====================== 岗位推荐排序 ======================

/**
 * 按匹配度对学生与一批岗位排序（降序）。
 * 用于「适配岗位推荐」列表。
 */
export const rankJobsByMatch = (student: StudentProfile, jobs: JobProfile[]): MatchResult[] =>
  jobs
    .map((job) => matchStudentToJob(student, job))
    .sort((a, b) => b.matchScore - a.matchScore);
