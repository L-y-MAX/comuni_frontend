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
} from '@/types/jobProfile';
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
  type StudentDimension,
  type StudentProfile,
  type StudentProfileInput,
  type StudentSkillItem,
  type SkillProficiency,
} from '@/types/studentProfile';
import {
  CERT_KEYWORDS,
  clampText,
  confidenceByHits,
  countDimensionHits,
  DIMENSION_SIGNALS,
  evidenceAround,
  extractDimensionEvidence,
  findOccurrences,
  SKILL_DICTIONARY,
  scoreByCertCount,
  scoreByHits,
  scoreBySkillCount,
} from '@/utils/jobProfileParser';

// ====================== 熟练度判定 ======================

/** 「熟练」类措辞 */
const PROFICIENT_MARKERS = ['熟练', '精通', '掌握', '擅长', '深入', '熟练使用'];
/** 「了解」类措辞 */
const BASIC_MARKERS = ['了解', '接触', '入门', '初步', '基本了解', '学习中'];

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
  const BOUNDARY = /[。！？；;\n\r，,]/;
  let start = idx;
  while (start > 0 && !BOUNDARY.test(text[start - 1])) start -= 1;
  let end = idx;
  while (end < text.length && !BOUNDARY.test(text[end])) end += 1;
  const sentence = text.slice(start, end);

  if (PROFICIENT_MARKERS.some((m) => sentence.includes(m))) return 'proficient';
  if (BASIC_MARKERS.some((m) => sentence.includes(m))) return 'basic';
  return 'unknown';
};

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
  keywordLength: number
): SkillProficiency => {
  const all = positions.map((p) => judgeProficiency(text, p, keywordLength));
  if (all.includes('proficient')) return 'proficient';
  if (all.includes('basic')) return 'basic';
  return 'unknown';
};

/** 厂商认证模式（与岗位侧保持一致的口径） */
const VENDOR_CERT_PATTERN =
  /(阿里云|华为|思科|腾讯云|红帽|Oracle|微软|Adobe|Autodesk|达索|用友|金蝶|SAP)\s*(?:相关)?\s*认证/g;

// ====================== 抽取 ======================

/** 从语料中抽取学生具备的技能 */
const extractStudentSkills = (
  text: string
): { skills: StudentSkillItem[]; evidence: string[] } => {
  const skills: StudentSkillItem[] = [];
  const evidence: string[] = [];

  Object.entries(SKILL_DICTIONARY).forEach(([category, words]) => {
    words.forEach((word) => {
      const positions = findOccurrences(text, word);
      if (!positions.length) return;
      if (skills.some((s) => s.name.toLowerCase() === word.toLowerCase())) return;

      const idx = positions[0];
      skills.push({
        name: word,
        category,
        proficiency: strongestProficiency(text, positions, word.length),
      });

      if (evidence.length < 6) evidence.push(evidenceAround(text, idx, word.length));
    });
  });

  return { skills, evidence };
};

/** 从语料中抽取学生持有的证书 */
const extractStudentCerts = (text: string): { certificates: StudentCertItem[]; evidence: string[] } => {
  const certificates: StudentCertItem[] = [];
  const evidence: string[] = [];

  const push = (name: string, idx: number, len: number) => {
    if (certificates.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    certificates.push({ name });
    if (evidence.length < 4) evidence.push(evidenceAround(text, idx, len));
  };

  CERT_KEYWORDS.forEach((word) => {
    const positions = findOccurrences(text, word);
    if (!positions.length) return;
    push(word, positions[0], word.length);
  });

  // 厂商认证模式匹配。用 exec 循环而非 String.prototype.matchAll：
  // matchAll 是 ES2020，开发者工具 ES5 转换时会产生对
  // `@swc/helpers/_/_wrap_reg_exp` 的依赖，而该 helper 不会进产物，
  // 会导致小程序启动报 "module 'common/@swc/helpers/...' is not defined"。
  const certPattern = new RegExp(VENDOR_CERT_PATTERN.source, 'g');
  let certMatch: RegExpExecArray | null = certPattern.exec(text);
  while (certMatch !== null) {
    const vendor = certMatch[1];
    if (vendor) push(`${vendor}认证`, certMatch.index, vendor.length + 2);
    if (certMatch.index === certPattern.lastIndex) certPattern.lastIndex += 1;
    certMatch = certPattern.exec(text);
  }

  return { certificates, evidence };
};

// ====================== 完整度 ======================

/** 这几个字段属于短字段，只要有内容即视为填满 */
const SHORT_FIELDS: CompletenessField[] = ['major', 'grade', 'target_job'];

/** 计算信息完整度及其明细 */
export const calcCompleteness = (
  input: StudentProfileInput
): { completeness: number; detail: CompletenessDetail[]; missing: string[] } => {
  const detail: CompletenessDetail[] = [];
  const missing: string[] = [];
  let total = 0;

  COMPLETENESS_FIELDS_ORDER.forEach((field) => {
    const fullScore = COMPLETENESS_WEIGHTS[field];
    const raw = String((input as unknown as Record<string, unknown>)[field] ?? '').trim();

    let ratio = 0;
    if (raw) {
      ratio = SHORT_FIELDS.includes(field)
        ? 1
        : raw.length >= FIELD_SUFFICIENT_LENGTH
          ? 1
          : 0.5;
    }

    const score = Math.round(fullScore * ratio);
    total += score;
    if (!raw) missing.push(COMPLETENESS_FIELD_LABEL[field]);

    detail.push({
      field,
      label: COMPLETENESS_FIELD_LABEL[field],
      filled: !!raw,
      ratio,
      score,
      fullScore,
    });
  });

  return { completeness: Math.min(100, total), detail, missing };
};

// ====================== 竞争力 ======================

/**
 * 综合就业竞争力评分。
 *
 * 做法：先按十维权重求加权分，再用**完整度**打折——
 * 信息填得越少，评分越保守（完整度 0 时只有加权分的 65%）。
 * 这样避免"只填两三个字却得到高分"的虚高结果。
 */
export const calcCompetitiveness = (dimensions: StudentDimension[], completeness: number): number => {
  const weighted = JOB_DIMENSIONS.reduce((sum, meta) => {
    const dim = dimensions.find((d) => d.key === meta.key);
    return sum + (dim?.score ?? 50) * meta.defaultWeight;
  }, 0);

  const factor = 0.65 + 0.35 * (Math.max(0, Math.min(100, completeness)) / 100);
  return Math.max(0, Math.min(100, Math.round(weighted * factor)));
};

// ====================== 徽章 ======================

/** 根据维度结果判定徽章墙 */
export const buildBadges = (dimensions: StudentDimension[]): StudentBadge[] => {
  const scoreOf = (key: AbilityDimensionKey) => dimensions.find((d) => d.key === key)?.score ?? 0;

  return BADGE_DEFINITIONS.map((def) => {
    // 单维度徽章
    if (def.dimension && typeof def.threshold === 'number') {
      const score = scoreOf(def.dimension);
      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        condition: def.condition,
        dimension: def.dimension,
        unlocked: score >= def.threshold,
        progress: def.threshold > 0 ? Math.min(1, Number((score / def.threshold).toFixed(3))) : 0,
      };
    }

    // 全局徽章：所有维度都不低于阈值
    const threshold = def.allDimensionsAbove ?? 80;
    const passed = dimensions.filter((d) => d.score >= threshold).length;
    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      condition: def.condition,
      unlocked: dimensions.length > 0 && passed === dimensions.length,
      progress: dimensions.length ? Number((passed / dimensions.length).toFixed(3)) : 0,
    };
  });
};

// ====================== 总述 ======================

const buildSummary = (
  input: StudentProfileInput,
  dimensions: StudentDimension[],
  strengths: AbilityDimensionKey[],
  weaknesses: AbilityDimensionKey[],
  completeness: number,
  competitiveness: number
): string => {
  const labelOf = (key: AbilityDimensionKey) =>
    dimensions.find((d) => d.key === key)?.label ?? key;

  const gradeText = input.grade ? `${GRADE_LABEL[input.grade as GradeKey]}·` : '';
  const majorText = input.major ? `${input.major}` : '本专业';
  const targetText = input.target_job ? `，意向岗位为${input.target_job}` : '';

  const strengthText = strengths.length
    ? `优势集中在${strengths.map(labelOf).join('、')}`
    : '暂未识别出明显优势维度';

  const weaknessText = weaknesses.length
    ? `${weaknesses.map(labelOf).join('、')}是当前相对短板`
    : '暂未识别出明确短板';

  const completenessText =
    completeness >= 85
      ? '信息填写较为完整，评分可信度较高'
      : completeness >= 60
        ? `信息完整度 ${completeness}%，补充更多经历可让评分更准确`
        : `信息完整度仅 ${completeness}%，当前评分可能偏低，建议补齐项目与实习经历`;

  return (
    `你是${gradeText}${majorText}学生${targetText}。` +
    `综合就业竞争力评分 ${competitiveness} 分，${strengthText}，${weaknessText}。` +
    `${completenessText}。` +
    `本画像由本地关键词规则解析生成；接入千问大模型解析后，可从简历原文中抽取更细的能力证据。`
  );
};

// ====================== 主入口 ======================

/** 汇总学生填写内容为解析语料 */
const buildCorpus = (input: StudentProfileInput): string =>
  clampText(
    [
      input.major,
      input.target_job,
      input.target_industry,
      input.skills_text,
      input.certificates_text,
      input.projects_text,
      input.internships_text,
      input.awards_text,
      input.gpa,
      input.self_evaluation,
      input.resume_text,
    ]
      .filter(Boolean)
      .join('\n')
  );

/**
 * 本地规则解析入口：把学生填写的信息解析为十维能力画像。
 *
 * @returns 归一化后的 StudentProfile（十维齐全，且含完整度、竞争力、徽章）
 */
export const parseStudentProfileByRules = (input: StudentProfileInput): StudentProfile => {
  const corpus = buildCorpus(input);

  const { skills, evidence: skillEvidence } = extractStudentSkills(corpus);
  const { certificates, evidence: certEvidence } = extractStudentCerts(corpus);
  const proficientCount = skills.filter((s) => s.proficiency === 'proficient').length;

  const dimensions: StudentDimension[] = JOB_DIMENSIONS.map((meta) => {
    // ---- 专业技能：由识别出的技能数量与熟练程度决定 ----
    if (meta.key === 'professional_skill') {
      const score = scoreBySkillCount(skills.length, proficientCount);
      return {
        key: meta.key,
        label: studentDimensionLabel(meta.key),
        score,
        level: scoreToLevel(score),
        // 一项技能都没识别出来时，只说明"没写"，不代表能力差，
        // 因此置信度给到 0.2（低于界面的「信息不足」阈值 0.35），
        // 从而不会被误判为短板。
        confidence: skills.length ? Math.min(0.9, 0.4 + skills.length * 0.08) : 0.2,
        source: 'rule' as ParseSource,
        evidence: skillEvidence,
        skills,
      };
    }

    // ---- 证书资质：由证书数量决定 ----
    if (meta.key === 'certificate') {
      const score = scoreByCertCount(certificates.length);
      return {
        key: meta.key,
        label: studentDimensionLabel(meta.key),
        score,
        level: scoreToLevel(score),
        confidence: certificates.length ? Math.min(0.85, 0.4 + certificates.length * 0.15) : 0.3,
        source: 'rule' as ParseSource,
        evidence: certEvidence,
        certificates,
      };
    }

    // ---- 其余 8 个软性维度：信号词命中 ----
    const keywords = DIMENSION_SIGNALS[meta.key] ?? [];
    const hitCount = countDimensionHits(corpus, keywords);
    const score = scoreByHits(hitCount);

    return {
      key: meta.key,
      label: studentDimensionLabel(meta.key),
      score,
      level: scoreToLevel(score) as AbilityLevel,
      confidence: confidenceByHits(hitCount),
      source: 'rule' as ParseSource,
      evidence: extractDimensionEvidence(corpus, keywords),
    };
  });

  const { completeness, detail, missing } = calcCompleteness(input);
  const competitiveness = calcCompetitiveness(dimensions, completeness);

  // 优势：分值 >= 70 的前 3 项
  const strengths = [...dimensions]
    .sort((a, b) => b.score - a.score)
    .filter((d) => d.score >= 70)
    .slice(0, 3)
    .map((d) => d.key);

  // 短板：分值 <= 60 且**置信度足够**的最低 3 项
  // （置信度低说明只是没写，不代表能力弱，不应判为短板）
  const weaknesses = [...dimensions]
    .sort((a, b) => a.score - b.score)
    .filter((d) => d.score <= 60 && d.confidence >= 0.35)
    .slice(0, 3)
    .map((d) => d.key);

  const badges = buildBadges(dimensions);

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
  });

  profile.summary = buildSummary(
    input,
    profile.dimensions,
    profile.strengths,
    profile.weaknesses,
    completeness,
    competitiveness
  );

  return profile;
};

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
};
