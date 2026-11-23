/**
 * 学生能力画像 —— 本地规则解析器（兜底方案）
 *
 * 与岗位画像解析器（utils/jobProfileParser.ts）同构：
 *   1. 千问接口就绪前，页面能真实产出十维能力画像，功能可演示；
 *   2. 千问接口异常时作为降级兜底；
 *   3. 结果带 source='rule' 与较低 confidence，界面对用户如实标注来源。
 *
 * 与岗位侧的关键差异：
 *   - 语料来自**学生自己填写的表单**，而不是爬取的招聘文本，因此信息量天然更少；
 *   - 维度分值语义相反：这里分值高 = 该学生这一维度**能力强**；
 *   - 必须额外产出「信息完整度」与「综合就业竞争力」两个总评分（计划书要求）；
 *   - 需要判定徽章墙。
 *
 * 重要：本解析器对「学生没写」和「学生不具备」无法区分。
 * 因此未命中信号词时给的是**中性分（50）+ 极低置信度**，而不是低分，
 * 并由界面提示「信息不足，建议补充」——避免把"没写"误判成"能力差"。
 */

import {
  JOB_DIMENSIONS,
  scoreToLevel,
  type AbilityDimensionKey,
  type AbilityLevel,
  type ParseSource,
} from '@/types/jobProfile'
import {
  BADGE_DEFINITIONS,
  COMPLETENESS_FIELDS_ORDER,
  COMPLETENESS_FIELD_LABEL,
  COMPLETENESS_WEIGHTS,
  FIELD_SUFFICIENT_LENGTH,
  GRADE_LABEL,
  normalizeStudentProfile,
  studentDimensionLabel,
  type CompletenessDetail,
  type CompletenessField,
  type GradeKey,
  type StudentBadge,
  type StudentCertItem,
  type DimensionParseDetail,
  type StudentDimension,
  type StudentProfile,
  type StudentProfileInput,
  type StudentSkillItem,
  type SkillProficiency,
} from '@/types/studentProfile'
import {
  CERT_KEYWORDS,
  clampText,
  DIMENSION_SIGNALS,
  evidenceAround,
  findOccurrences,
  filterCompoundFalsePositives,
  isInsideAnySpan,
  isNegatedOccurrence,
  SKILL_DICTIONARY,
  scoreByCertCount,
  scoreBySkillCount,
  type MatchSpan,
} from '@/utils/jobProfileParser'
import { expandTermVariants, normalizeCertName, normalizeSkillName } from '@/utils/skill-normalizer'

// ====================== 熟练度判定 ======================

/** 「熟练」类措辞 */
const PROFICIENT_MARKERS = ['熟练', '精通', '掌握', '擅长', '深入', '熟练使用']
/** 「了解」类措辞 */
const BASIC_MARKERS = ['了解', '接触', '入门', '初步', '基本了解', '学习中']

/**
 * 判断学生对某项技能的熟练度声明。
 *
 * 边界只切到「逗号/句号/分号/换行」，**故意不切顿号**：
 * 学生常写成「熟练使用 Java、SpringBoot、MySQL，了解 Redis」，
 * 若把顿号也当边界，则 Java 之后的技能都会丢掉「熟练」这个声明。
 *
 * 取值来源是学生自己的措辞，而非岗位要求，因此与岗位侧的 must/preferred 不是一回事。
 */
const judgeProficiency = (text: string, idx: number, keywordLength: number): SkillProficiency => {
  const BOUNDARY = /[。！？；;\n\r，,]/
  let start = idx
  while (start > 0 && !BOUNDARY.test(text[start - 1])) start -= 1
  let end = idx
  while (end < text.length && !BOUNDARY.test(text[end])) end += 1
  const sentence = text.slice(start, end)

  if (PROFICIENT_MARKERS.some((m) => sentence.includes(m))) return 'proficient'
  if (BASIC_MARKERS.some((m) => sentence.includes(m))) return 'basic'
  return 'unknown'
}

/**
 * 综合某项技能的**所有出现位置**取最明确的熟练度声明。
 *
 * 必要性：技能名可能先出现在别处（例如 Java 先出现在「意向岗位：Java开发工程师」里，
 * 那里没有熟练度措辞），若只看首次出现就会漏判为「待补充」。
 * 优先级：proficient > basic > unknown。
 */
const strongestProficiency = (
  text: string,
  positions: number[],
  keywordLength: number,
): SkillProficiency => {
  const all = positions.map((p) => judgeProficiency(text, p, keywordLength))
  if (all.includes('proficient')) return 'proficient'
  if (all.includes('basic')) return 'basic'
  return 'unknown'
}

/** 厂商认证模式（与岗位侧保持一致的口径） */
const VENDOR_CERT_PATTERN =
  /(阿里云|华为|思科|腾讯云|红帽|Oracle|微软|Adobe|Autodesk|达索|用友|金蝶|SAP)\s*(?:相关)?\s*认证/g

// ====================== 抽取 ======================

/** 从语料中抽取学生具备的技能 */
const extractStudentSkills = (text: string): { skills: StudentSkillItem[]; evidence: string[] } => {
  const skills: StudentSkillItem[] = []
  const evidence: string[] = []
  const spans: MatchSpan[] = []

  // 最长匹配优先，避免「Java」命中「JavaScript」、「SQL」命中「MySQL」
  const entries = Object.entries(SKILL_DICTIONARY)
    .flatMap(([category, words]) => words.map((word) => ({ category, word })))
    .sort((a, b) => b.word.length - a.word.length)

  entries.forEach(({ category, word }) => {
    let positions: number[] = []
    let matchedLen = word.length
    for (const variant of expandTermVariants(word)) {
      const candidate = filterCompoundFalsePositives(
        text,
        variant,
        findOccurrences(text, variant),
      ).filter(
        (p) =>
          !isInsideAnySpan(p, variant.length, spans) &&
          !isNegatedOccurrence(text, p, variant.length),
      )
      if (candidate.length) {
        positions = candidate
        matchedLen = variant.length
        break
      }
    }
    if (!positions.length) return
    if (skills.some((s) => normalizeSkillName(s.name) === normalizeSkillName(word))) return

    positions.forEach((p) => spans.push({ start: p, end: p + matchedLen }))
    const idx = positions[0]
    skills.push({
      name: word,
      category,
      proficiency: strongestProficiency(text, positions, matchedLen),
    })

    if (evidence.length < 6) evidence.push(evidenceAround(text, idx, matchedLen))
  })

  return { skills, evidence }
}

/** 从语料中抽取学生持有的证书 */
const extractStudentCerts = (
  text: string,
): { certificates: StudentCertItem[]; evidence: string[] } => {
  const certificates: StudentCertItem[] = []
  const evidence: string[] = []

  const push = (name: string, idx: number, len: number) => {
    if (certificates.some((c) => normalizeCertName(c.name) === normalizeCertName(name))) return
    certificates.push({ name })
    if (evidence.length < 4) evidence.push(evidenceAround(text, idx, len))
  }

  const certSpans: MatchSpan[] = []
  ;[...CERT_KEYWORDS]
    .sort((a, b) => b.length - a.length)
    .forEach((word) => {
      for (const variant of expandTermVariants(word)) {
        const positions = findOccurrences(text, variant).filter(
          (p) =>
            !isInsideAnySpan(p, variant.length, certSpans) &&
            !isNegatedOccurrence(text, p, variant.length),
        )
        if (!positions.length) continue
        positions.forEach((p) => certSpans.push({ start: p, end: p + variant.length }))
        push(word, positions[0], variant.length)
        break
      }
    })

  // 厂商认证模式匹配。用 exec 循环而非 String.prototype.matchAll：
  // matchAll 是 ES2020，开发者工具 ES5 转换时会产生对
  // `@swc/helpers/_/_wrap_reg_exp` 的依赖，而该 helper 不会进产物，
  // 会导致小程序启动报 "module 'common/@swc/helpers/...' is not defined"。
  const certPattern = new RegExp(VENDOR_CERT_PATTERN.source, 'g')
  let certMatch: RegExpExecArray | null = certPattern.exec(text)
  while (certMatch !== null) {
    const vendor = certMatch[1]
    if (vendor) push(`${vendor}认证`, certMatch.index, vendor.length + 2)
    if (certMatch.index === certPattern.lastIndex) certPattern.lastIndex += 1
    certMatch = certPattern.exec(text)
  }

  return { certificates, evidence }
}

// ====================== 完整度 ======================

/** 这几个字段属于短字段，只要有内容即视为填满 */
const SHORT_FIELDS: CompletenessField[] = ['major', 'grade', 'target_job']

/** 计算信息完整度及其明细 */
export const calcCompleteness = (
  input: StudentProfileInput,
): { completeness: number; detail: CompletenessDetail[]; missing: string[] } => {
  const detail: CompletenessDetail[] = []
  const missing: string[] = []
  let total = 0

  COMPLETENESS_FIELDS_ORDER.forEach((field) => {
    const fullScore = COMPLETENESS_WEIGHTS[field]
    const raw = String((input as unknown as Record<string, unknown>)[field] ?? '').trim()

    let ratio = 0
    if (raw) {
      ratio = SHORT_FIELDS.includes(field) ? 1 : raw.length >= FIELD_SUFFICIENT_LENGTH ? 1 : 0.5
    }

    const score = Math.round(fullScore * ratio)
    total += score
    if (!raw) missing.push(COMPLETENESS_FIELD_LABEL[field])

    detail.push({
      field,
      label: COMPLETENESS_FIELD_LABEL[field],
      filled: !!raw,
      ratio,
      score,
      fullScore,
    })
  })

  return { completeness: Math.min(100, total), detail, missing }
}

// ====================== 竞争力 ======================

/**
 * 综合就业竞争力评分。
 *
 * 做法：先按十维权重求加权分，再用**完整度**打折——
 * 信息填得越少，评分越保守（完整度 0 时只有加权分的 65%）。
 * 这样避免"只填两三个字却得到高分"的虚高结果。
 */
export const calcCompetitiveness = (
  dimensions: StudentDimension[],
  completeness: number,
): number => {
  const weighted = JOB_DIMENSIONS.reduce((sum, meta) => {
    const dim = dimensions.find((d) => d.key === meta.key)
    return sum + (dim?.score ?? 50) * meta.defaultWeight
  }, 0)

  const factor = 0.65 + 0.35 * (Math.max(0, Math.min(100, completeness)) / 100)
  return Math.max(0, Math.min(100, Math.round(weighted * factor)))
}

// ====================== 徽章 ======================

/** 根据维度结果判定徽章墙 */
export const buildBadges = (dimensions: StudentDimension[]): StudentBadge[] => {
  const scoreOf = (key: AbilityDimensionKey) => dimensions.find((d) => d.key === key)?.score ?? 0

  return BADGE_DEFINITIONS.map((def) => {
    // 单维度徽章
    if (def.dimension && typeof def.threshold === 'number') {
      const score = scoreOf(def.dimension)
      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        name_en: def.name_en,
        condition: def.condition,
        dimension: def.dimension,
        unlocked: score >= def.threshold,
        progress: def.threshold > 0 ? Math.min(1, Number((score / def.threshold).toFixed(3))) : 0,
      }
    }

    // 全局徽章：所有维度都不低于阈值
    const threshold = def.allDimensionsAbove ?? 80
    const passed = dimensions.filter((d) => d.score >= threshold).length
    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      name_en: def.name_en,
      condition: def.condition,
      unlocked: dimensions.length > 0 && passed === dimensions.length,
      progress: dimensions.length ? Number((passed / dimensions.length).toFixed(3)) : 0,
    }
  })
}

// ====================== 总述 ======================

const buildSummary = (
  input: StudentProfileInput,
  dimensions: StudentDimension[],
  strengths: AbilityDimensionKey[],
  weaknesses: AbilityDimensionKey[],
  completeness: number,
  competitiveness: number,
): string => {
  const labelOf = (key: AbilityDimensionKey) => dimensions.find((d) => d.key === key)?.label ?? key

  const gradeText = input.grade ? `${GRADE_LABEL[input.grade as GradeKey]}·` : ''
  const majorText = input.major ? `${input.major}` : '本专业'
  const targetText = input.target_job ? `，意向岗位为${input.target_job}` : ''

  const strengthText = strengths.length
    ? `优势集中在${strengths.map(labelOf).join('、')}`
    : '暂未识别出明显优势维度'

  const weaknessText = weaknesses.length
    ? `${weaknesses.map(labelOf).join('、')}是当前相对短板`
    : '暂未识别出明确短板'

  const completenessText =
    completeness >= 85
      ? '信息填写较为完整，评分可信度较高'
      : completeness >= 60
        ? `信息完整度 ${completeness}%，补充更多经历可让评分更准确`
        : `信息完整度仅 ${completeness}%，当前评分可能偏低，建议补齐项目与实习经历`

  return (
    `你是${gradeText}${majorText}学生${targetText}。` +
    `综合就业竞争力评分 ${competitiveness} 分，${strengthText}，${weaknessText}。` +
    `${completenessText}。` +
    `本画像由本地关键词规则解析生成；接入 DeepSeek 大模型解析后，可从简历原文中抽取更细的能力证据。`
  )
}

// ====================== 主入口 ======================

/** 汇总指定字段为解析语料，避免技能/证书/自评互相污染 */
const buildCorpusFromFields = (
  input: StudentProfileInput,
  fields: (keyof StudentProfileInput)[],
): string =>
  clampText(
    fields
      .map((field) => String(input[field] ?? '').trim())
      .filter(Boolean)
      .join('\n'),
  )

/** 技能证据优先来自技能、项目、实习和简历原文；自评不算硬技能证据 */
const SKILL_FIELDS: (keyof StudentProfileInput)[] = [
  'skills_text',
  'projects_text',
  'internships_text',
  'resume_text',
]

/** 证书只从证书栏和简历原文抽取 */
const CERT_FIELDS: (keyof StudentProfileInput)[] = ['certificates_text', 'resume_text']

/** 软性维度优先看项目/实习/技能/获奖等事实字段 */
const CORE_FIELDS: (keyof StudentProfileInput)[] = [
  'major',
  'target_job',
  'target_industry',
  'skills_text',
  'certificates_text',
  'projects_text',
  'internships_text',
  'awards_text',
  'gpa',
  'resume_text',
]

/** 自我评价单独作为弱信号，不和事实字段混在一起 */
const SELF_FIELDS: (keyof StudentProfileInput)[] = ['self_evaluation']

/**
 * 本地规则解析入口：把学生填写的信息解析为十维能力画像。
 *
 * @returns 归一化后的 StudentProfile（十维齐全，且含完整度、竞争力、徽章）
 */
// ====================== 解析明细（把评分过程写清楚） ======================

/** 没有有效证据时的中性基准分与置信度 */
const NEUTRAL_SCORE = 50
const NEUTRAL_CONFIDENCE = 0.25

/** 「信息不足」阈值（与界面 abilityProfile.vue 的 INFO_THRESHOLD 一致），只用于文案 */
const INFO_THRESHOLD_FOR_TEXT = 0.35

/** 一项技能都没识别出来时只说明"没写"，不代表能力差，置信度压低到信息不足阈值以下 */
const SKILL_EMPTY_CONFIDENCE = 0.2
/** 同理：一项证书都没识别出来时 */
const CERT_EMPTY_CONFIDENCE = 0.3

/** 补充建议：按依据类型给出，不描述具体算法细节，避免与实现脱节 */
const ADVICE_BY_KIND: Record<DimensionParseDetail['kind'], string> = {
  keyword:
    '优先写「角色 + 动作 + 结果」，例如「担任组长，主导需求对接，项目提前 3 天上线」；只有形容词的描述支撑力较弱。',
  skill:
    '按「技能 + 熟练度」的写法补充，例如「熟练使用 Vue3」：识别出的技能越多、标注「熟练」的越多，分值越高。',
  certificate: '补充已取得证书的全称，例如「全国计算机等级考试二级」：每多一项证书，分值上升一档。',
}

// ====================== 软性维度证据强度 ======================

export type EvidenceStrength = 'strong' | 'medium' | 'weak'

interface EvidenceUnit {
  text: string
  strength: EvidenceStrength
  keyword: string
  source: 'core' | 'self'
}

const ROLE_MARKERS = [
  '负责人', '组长', '队长', '主讲', '核心成员', '主席', '部长', '班长',
  '组长', '带队', '组织者', '发起人', '第一作者',
]

const ACTION_MARKERS = [
  '负责', '主导', '设计', '开发', '优化', '重构', '对接', '组织', '协调',
  '落地', '实施', '搭建', '维护', '推进', '汇报', '讲解', '编写', '测试',
  '分析', '管理', '带领', '统筹', '策划', '执行', '改进',
]

const RESULT_PATTERN =
  /\d+(?:\.\d+)?\s*(?:%|％|天|人|个|项|次|万|元|小时|分)|提升|降低|增长|减少|缩短|获奖|一等奖|二等奖|三等奖|金奖|银奖|铜奖|前\s*\d+|排名|上线|交付|验收|优秀/

/** 切分证据句：保留逗号，避免把「负责…，结果…」拆成两句 */
const splitEvidenceSentences = (text: string): string[] =>
  text
    .split(/[。；;！？!?\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)

/** 这个句子里是否有未被否定的维度关键词 */
const hasNonNegatedKeyword = (sentence: string, keywords: string[]): string | null => {
  for (const keyword of keywords) {
    const positions = findOccurrences(sentence, keyword)
    if (positions.some((p) => !isNegatedOccurrence(sentence, p, keyword.length))) {
      return keyword
    }
  }
  return null
}

const classifyEvidence = (sentence: string, source: 'core' | 'self'): EvidenceStrength => {
  // 自我评价里的形容词只算弱证据，不因为写了「能力强」就拔高
  if (source === 'self') return 'weak'

  const hasRole = ROLE_MARKERS.some((m) => sentence.includes(m))
  const hasAction = ACTION_MARKERS.some((m) => sentence.includes(m))
  const hasResult = RESULT_PATTERN.test(sentence)

  if (hasResult) return 'strong'
  if (hasAction || hasRole) return 'medium'
  return 'weak'
}

const collectEvidence = (
  corpus: string,
  source: 'core' | 'self',
  keywords: string[],
): EvidenceUnit[] => {
  const units: EvidenceUnit[] = []
  splitEvidenceSentences(corpus).forEach((sentence) => {
    const keyword = hasNonNegatedKeyword(sentence, keywords)
    if (!keyword) return
    units.push({
      text: sentence,
      strength: classifyEvidence(sentence, source),
      keyword,
      source,
    })
  })
  return units
}

const scoreByEvidence = (units: EvidenceUnit[]): number => {
  const strongCount = units.filter((u) => u.strength === 'strong').length
  const mediumCount = units.filter((u) => u.strength === 'medium').length
  const weakCount = units.filter((u) => u.strength === 'weak').length

  if (strongCount > 0) {
    return Math.min(100, 72 + Math.min(18, (strongCount - 1) * 5 + mediumCount * 2))
  }
  if (mediumCount > 0) {
    return Math.min(75, 60 + Math.min(15, (mediumCount - 1) * 3))
  }
  if (weakCount > 0) {
    return Math.min(60, 50 + Math.min(10, (weakCount - 1) * 2))
  }
  return NEUTRAL_SCORE
}

const confidenceByEvidence = (units: EvidenceUnit[]): number => {
  const strongCount = units.filter((u) => u.strength === 'strong').length
  const mediumCount = units.filter((u) => u.strength === 'medium').length
  if (strongCount > 0) return Math.min(0.9, 0.8 + strongCount * 0.02)
  if (mediumCount > 0) return 0.62
  if (units.length > 0) return 0.35
  return NEUTRAL_CONFIDENCE
}

const buildEvidenceDetail = (
  units: EvidenceUnit[],
  keywords: string[],
  score: number,
  confidence: number,
): DimensionParseDetail => {
  const strong = units.filter((u) => u.strength === 'strong').length
  const medium = units.filter((u) => u.strength === 'medium').length
  const weak = units.filter((u) => u.strength === 'weak').length
  const matched = Array.from(new Set(units.map((u) => u.keyword)))
  const { missed } = splitSignals(
    units.map((u) => u.text).join('\n'),
    keywords,
  )

  return {
    kind: 'keyword',
    matched_keywords: matched,
    missed_keywords: missed,
    matched_count: matched.length,
    bonus_count: strong,
    signal_total: keywords.length,
    score_formula: units.length
      ? `识别到 ${strong} 条强证据、${medium} 条中证据、${weak} 条弱证据；按最强证据定上限，再按证据数量加分，得 ${score} 分。`
      : `这一项没有识别到有效证据，按中性基准记 ${NEUTRAL_SCORE} 分——只说明“没写到”，不代表能力不足。`,
    score_curve:
      '强证据（有角色/动作/结果）上限 100；中证据（有动作无结果）上限 75；弱证据（仅形容词/自评）上限 60。',
    confidence_formula: units.length
      ? `强证据 ${strong} 条、中证据 ${medium} 条、弱证据 ${weak} 条，置信度取 ${confidence.toFixed(2)}。`
      : `没有有效证据，置信度取 ${NEUTRAL_CONFIDENCE}，低于 ${INFO_THRESHOLD_FOR_TEXT} 的「信息不足」阈值。`,
    advice: ADVICE_BY_KIND.keyword,
  }
}

/** 把依据词表拆成「已命中」与「还没命中」两份，后者用于告诉用户补充什么能加分 */
const splitSignals = (
  text: string,
  keywords: string[],
  missLimit = 8,
): { matched: string[]; missed: string[] } => {
  const matched: string[] = []
  const missed: string[] = []
  keywords.forEach((kw) => {
    if (findOccurrences(text, kw).length > 0) matched.push(kw)
    else if (missed.length < missLimit) missed.push(kw)
  })
  return { matched, missed }
}

export interface EvidenceCandidateSentence {
  id: string
  text: string
}

export interface EvidenceCandidateGroup {
  dimension: string
  label: string
  sentences: EvidenceCandidateSentence[]
}

export interface EvidenceClassificationItem {
  id: string
  strength: EvidenceStrength | 'none'
  quote?: string
  role?: string
  action?: string
  result?: string
  confidence?: number
}

/** 只挑规则置信度低的软性维度，交给 AI 复核句子强度 */
export const collectLowConfidenceEvidence = (
  input: StudentProfileInput,
  profile: StudentProfile,
  threshold = 0.62,
): EvidenceCandidateGroup[] => {
  const coreCorpus = buildCorpusFromFields(input, CORE_FIELDS)
  const selfCorpus = buildCorpusFromFields(input, SELF_FIELDS)
  const groups: EvidenceCandidateGroup[] = []

  const softKeys = Object.keys(DIMENSION_SIGNALS).filter(
    (key) => key !== 'professional_skill' && key !== 'certificate',
  )

  softKeys.forEach((key) => {
    const dimension = profile.dimensions.find((d) => d.key === key)
    if (!dimension || dimension.confidence >= threshold) return

    const keywords = DIMENSION_SIGNALS[key] ?? []
    const coreUnits = collectEvidence(coreCorpus, 'core', keywords)
    const units = coreUnits.length ? coreUnits : collectEvidence(selfCorpus, 'self', keywords)
    const lowConfidence = units.filter((u) => u.strength !== 'strong')
    if (!lowConfidence.length) return

    const sentences: EvidenceCandidateSentence[] = []
    const seen = new Set<string>()
    lowConfidence.slice(0, 5).forEach((unit) => {
      if (seen.has(unit.text)) return
      seen.add(unit.text)
      sentences.push({ id: `${key}-${sentences.length + 1}`, text: unit.text })
    })
    if (!sentences.length) return
    groups.push({ dimension: key, label: dimension.label, sentences })
  })

  return groups.slice(0, 3)
}

/** 把 AI 的句子强度结果合并回画像；没有有效证据时保留原规则结果 */
export const applyEvidenceClassifications = (
  input: StudentProfileInput,
  profile: StudentProfile,
  dimensionKey: string,
  items: EvidenceClassificationItem[],
): StudentProfile => {
  const dimension = profile.dimensions.find((d) => d.key === dimensionKey)
  if (!dimension) return profile

  const keywords = DIMENSION_SIGNALS[dimensionKey] ?? []
  const units: EvidenceUnit[] = items
    .filter(
      (item): item is EvidenceClassificationItem & { strength: EvidenceStrength } =>
        item.strength !== 'none' && !!item.quote,
    )
    .map((item) => {
      let strength = item.strength
      // 防止 AI 把「沟通能力强」升级成强证据：
      // strong 必须有角色/动作/结果，medium 至少要有一个动作或角色。
      if (strength === 'strong' && !item.result) strength = 'medium'
      if (strength === 'medium' && !item.role && !item.action) strength = 'weak'
      return {
        text: item.quote as string,
        strength,
        keyword: keywords.find((k) => (item.quote as string).includes(k)) ?? dimension.label,
        source: 'core' as const,
      }
    })
    .slice(0, 4)

  // AI 也没找到有效证据时，不动规则结果，避免把一条正常证据判没
  if (!units.length) return profile

  const score = scoreByEvidence(units)
  const confidence = confidenceByEvidence(units)
  const dimensions = profile.dimensions.map((d) =>
    d.key === dimensionKey
      ? {
          ...d,
          score,
          level: scoreToLevel(score) as AbilityLevel,
          confidence,
          evidence: units.map((u) => u.text).slice(0, 3),
          parse_detail: buildEvidenceDetail(units, keywords, score, confidence),
        }
      : d,
  )

  const competitiveness = calcCompetitiveness(dimensions, profile.completeness)
  const strengths = [...dimensions]
    .sort((a, b) => b.score - a.score)
    .filter((d) => d.score >= 70)
    .slice(0, 3)
    .map((d) => d.key)
  const weaknesses = [...dimensions]
    .sort((a, b) => a.score - b.score)
    .filter((d) => d.score <= 60 && d.confidence >= 0.35)
    .slice(0, 3)
    .map((d) => d.key)

  return {
    ...profile,
    dimensions,
    competitiveness,
    strengths,
    weaknesses,
    badges: buildBadges(dimensions),
    summary: buildSummary(input, dimensions, strengths, weaknesses, profile.completeness, competitiveness),
  }
}

/** 专业技能维度的解析明细：由「识别到的技能数 + 标注熟练的数量」决定 */const buildSkillDetail = (
  skills: StudentSkillItem[],
  proficientCount: number,
  score: number,
  confidence: number,
): DimensionParseDetail => {
  const dictSize = Object.values(SKILL_DICTIONARY).reduce((n, words) => n + words.length, 0)
  const names = skills.map((s) => s.name)
  return {
    kind: 'skill',
    matched_keywords: names,
    missed_keywords: [],
    matched_count: skills.length,
    bonus_count: proficientCount,
    signal_total: dictSize,
    score_formula: skills.length
      ? `在技能词典（共 ${dictSize} 个词条）中识别到 ${skills.length} 项技能，其中 ${proficientCount} 项标注为「熟练」：技能数决定基础档位，再按「熟练」项数加分，得 ${score} 分。`
      : `技能词典（共 ${dictSize} 个词条）里一项技能都没识别到，按基准 40 分计——请检查是否漏填了技能，而不是直接认定技能弱。`,
    score_curve:
      '技能 0 / 1 / 2 / 3 / 4 / 5 / 6 / 7 / ≥8 项 → 40 / 55 / 65 / 72 / 78 / 82 / 86 / 89 / 92 分；每有一项标注「熟练」再加 2 分，最多加 5 分，总分上限 100。',
    confidence_formula: skills.length
      ? `置信度 = 0.4 + 技能数 ${skills.length} × 0.08 = ${confidence.toFixed(2)}（上限 0.90）。`
      : `未识别到技能，置信度取 ${SKILL_EMPTY_CONFIDENCE}，低于 ${INFO_THRESHOLD_FOR_TEXT} 的「信息不足」阈值。`,
    advice: ADVICE_BY_KIND.skill,
  }
}

/** 证书维度的解析明细：由「识别到的证书数」决定 */
const buildCertDetail = (
  certificates: StudentCertItem[],
  score: number,
  confidence: number,
): DimensionParseDetail => ({
  kind: 'certificate',
  matched_keywords: certificates.map((c) => c.name),
  missed_keywords: [],
  matched_count: certificates.length,
  bonus_count: 0,
  signal_total: CERT_KEYWORDS.length,
  score_formula: certificates.length
    ? `在证书词表（共 ${CERT_KEYWORDS.length} 个词条）中识别到 ${certificates.length} 项证书，代入下方曲线得 ${score} 分。`
    : `证书词表（共 ${CERT_KEYWORDS.length} 个词条）里一项都没识别到，按基准 45 分计——没有证书不代表能力不足，但确实影响这一项得分。`,
  score_curve: '证书 0 / 1 / 2 / 3 / 4 / ≥5 项 → 45 / 58 / 68 / 76 / 82 / 88 分',
  confidence_formula: certificates.length
    ? `置信度 = 0.4 + 证书数 ${certificates.length} × 0.15 = ${confidence.toFixed(2)}（上限 0.85）。`
    : `未识别到证书，置信度取 ${CERT_EMPTY_CONFIDENCE}，低于 ${INFO_THRESHOLD_FOR_TEXT} 的「信息不足」阈值。`,
  advice: ADVICE_BY_KIND.certificate,
})

export const parseStudentProfileByRules = (input: StudentProfileInput): StudentProfile => {
  const skillCorpus = buildCorpusFromFields(input, SKILL_FIELDS)
  const certCorpus = buildCorpusFromFields(input, CERT_FIELDS)
  const coreCorpus = buildCorpusFromFields(input, CORE_FIELDS)
  const selfCorpus = buildCorpusFromFields(input, SELF_FIELDS)

  const { skills, evidence: skillEvidence } = extractStudentSkills(skillCorpus)
  const { certificates, evidence: certEvidence } = extractStudentCerts(certCorpus)
  const proficientCount = skills.filter((s) => s.proficiency === 'proficient').length

  const dimensions: StudentDimension[] = JOB_DIMENSIONS.map((meta) => {
    // ---- 专业技能：由识别出的技能数量与熟练程度决定 ----
    if (meta.key === 'professional_skill') {
      const score = scoreBySkillCount(skills.length, proficientCount)
      // 一项技能都没识别出来时，只说明"没写"，不代表能力差，
      // 因此置信度给到 0.2（低于界面的「信息不足」阈值 0.35），
      // 从而不会被误判为短板。
      const confidence = skills.length ? Math.min(0.9, 0.4 + skills.length * 0.08) : 0.2

      return {
        key: meta.key,
        label: studentDimensionLabel(meta.key),
        score,
        level: scoreToLevel(score),
        confidence,
        source: 'rule' as ParseSource,
        evidence: skillEvidence,
        skills,
        parse_detail: buildSkillDetail(skills, proficientCount, score, confidence),
      }
    }

    // ---- 证书资质：由证书数量决定 ----
    if (meta.key === 'certificate') {
      const score = scoreByCertCount(certificates.length)
      const confidence = certificates.length
        ? Math.min(0.85, 0.4 + certificates.length * 0.15)
        : 0.3

      return {
        key: meta.key,
        label: studentDimensionLabel(meta.key),
        score,
        level: scoreToLevel(score),
        confidence,
        source: 'rule' as ParseSource,
        evidence: certEvidence,
        certificates,
        parse_detail: buildCertDetail(certificates, score, confidence),
      }
    }

    // ---- 其余 8 个软性维度：事实字段优先，自评只作为弱信号 ----
    const keywords = DIMENSION_SIGNALS[meta.key] ?? []
    const coreUnits = collectEvidence(coreCorpus, 'core', keywords)
    const selfUnits = coreUnits.length ? [] : collectEvidence(selfCorpus, 'self', keywords)
    // 自评单独出现时最多计 1 条弱证据，避免形容词堆分数
    const units = (coreUnits.length ? coreUnits : selfUnits).slice(0, 4)

    const score = scoreByEvidence(units)
    const confidence = confidenceByEvidence(units)

    return {
      key: meta.key,
      label: studentDimensionLabel(meta.key),
      score,
      level: scoreToLevel(score) as AbilityLevel,
      confidence,
      source: 'rule' as ParseSource,
      evidence: units.map((u) => u.text).slice(0, 3),
      parse_detail: buildEvidenceDetail(units, keywords, score, confidence),
    }
  })

  const { completeness, detail, missing } = calcCompleteness(input)
  const competitiveness = calcCompetitiveness(dimensions, completeness)

  // 优势：分值 >= 70 的前 3 项
  const strengths = [...dimensions]
    .sort((a, b) => b.score - a.score)
    .filter((d) => d.score >= 70)
    .slice(0, 3)
    .map((d) => d.key)

  // 短板：分值 <= 60 且**置信度足够**的最低 3 项
  // （置信度低说明只是没写，不代表能力弱，不应判为短板）
  const weaknesses = [...dimensions]
    .sort((a, b) => a.score - b.score)
    .filter((d) => d.score <= 60 && d.confidence >= 0.35)
    .slice(0, 3)
    .map((d) => d.key)

  const badges = buildBadges(dimensions)

  const profile = normalizeStudentProfile({
    student_id: input.student_id ?? '',
    major: input.major,
    grade: input.grade,
    target_job: input.target_job,
    target_industry: input.target_industry,
    dimensions,
    completeness,
    completeness_detail: detail,
    missing_fields: missing,
    competitiveness,
    competitiveness_level: scoreToLevel(competitiveness),
    strengths,
    weaknesses,
    badges,
    summary: '',
    parse_method: 'rule',
    parsed_at: new Date().toISOString(),
  })

  profile.summary = buildSummary(
    input,
    profile.dimensions,
    profile.strengths,
    profile.weaknesses,
    completeness,
    competitiveness,
  )

  return profile
}

// ====================== 示例数据 ======================

/**
 * 示例数据：供「填入示例」按钮使用。
 * 目的是让老师/评委/队友在**不登录、无后端**的情况下也能一键看到完整画像效果。
 */
export const STUDENT_PROFILE_SAMPLE: StudentProfileInput = {
  student_id: '',
  major: '软件工程',
  grade: 'junior',
  target_job: 'Java开发工程师',
  target_industry: '数字经济',
  skills_text:
    '熟练使用 Java、SpringBoot、MySQL，了解 Redis、MyBatis；熟悉 HTML、CSS、JavaScript 与 Vue，能独立完成前后端小项目；掌握 Git 协作流程，了解 Linux 常用命令。',
  certificates_text: '已取得计算机二级、英语四级；正在备考阿里云相关认证。',
  projects_text:
    '校级大创项目「校园二手交易平台」负责人，负责需求分析与后端接口开发，独立完成 12 个接口，并通过索引优化把查询耗时降低 60%，项目结题优秀；参与开发学院课程设计管理系统，负责数据库设计。',
  internships_text:
    '2025年暑期在聊城某软件公司实习两个月，独立负责官网后台模块的开发与维护，动手实操能力强，累计修复 20 余个缺陷；实习期间参与团队代码评审与需求对接，熟悉企业协作流程。',
  awards_text: '校级一等奖学金、蓝桥杯省赛三等奖、校程序设计大赛二等奖。',
  gpa: '3.6/4.0，专业排名前 20%',
  self_evaluation:
    '学习能力强，能快速上手新技术，喜欢钻研底层原理；善于沟通表达，在团队中负责需求对接与进度汇报，多次主讲小组技术分享；性格踏实，能承受项目交付压力；持续关注数字经济领域的行业动态与产业趋势。',
}
