/**
 * 个性化职业生涯发展报告 —— 生成引擎（纯函数）
 *
 * 把前三个功能汇聚成一份可执行、可追踪的报告：
 *   学生能力画像（功能2） + 岗位画像（功能1） + 人岗匹配（功能3） + 岗位图谱（核心创新）
 *   → 匹配分析 / 职业目标与路径 / 分阶段成长计划 / 评估节点 / Markdown 全文
 *
 * 设计原则：
 *   1. **完全本地计算**，不依赖任何接口，因此未登录也能出报告（便于演示与答辩）；
 *   2. 成长计划的每一条都**从实际差距推导**，不做"多学习多实践"这类空话：
 *      缺哪项硬技能就写哪项，哪个维度分差大就针对哪个维度；
 *   3. 结构化数据与 Markdown 全文由同一份数据生成，保证界面看到的就是导出的内容。
 */

import { DIMENSION_ADVICE, rankJobsByMatch } from '@/utils/jobMatch';
import { buildJobGraph } from '@/utils/jobGraph';
import type { AbilityDimensionKey, JobProfile, ParseSource } from '@/types/jobProfile';
import type { MatchResult } from '@/types/jobMatch';
import type { StudentProfile } from '@/types/studentProfile';
import {
  CAREER_REPORT_STORAGE_KEY,
  PLAN_PHASE_LABEL,
  TASK_PRIORITY_LABEL,
  type CareerReport,
  type EvaluationMilestone,
  type GrowthTask,
  type PlanPhase,
} from '@/types/careerReport';

// ====================== 选项 ======================

export interface BuildReportOptions {
  /** 参与匹配的岗位数量上限（取匹配度最高的若干个） */
  topN?: number;
  /** 学生姓名（用于报告抬头，选填） */
  studentName?: string;
  /** 是否把已存在的任务完成状态带过来（重新生成报告时保留勾选进度） */
  previousTasks?: GrowthTask[];
}

// ====================== 成长计划生成 ======================

/**
 * 从匹配结果推导分阶段成长计划。
 *
 * 推导顺序刻意按「校招筛选的先后门槛」排：
 *   硬性技能 → 要求证书 → 实践经历 → 通用素质
 * 因为简历筛选时 HR 最先看的就是"要求的技能/证书有没有"，实践经历次之，
 * 软素质是用人面谈阶段才区分的。
 */
export const buildGrowthTasks = (match: MatchResult | null): GrowthTask[] => {
  const tasks: GrowthTask[] = [];
  let seq = 0;
  const nextId = (phase: PlanPhase) => `task-${phase}-${(seq += 1)}`;

  if (!match) {
    // 没有匹配结果时也给一份通用的成长框架，避免报告空白
    tasks.push({
      id: nextId('short'),
      phase: 'short',
      title: '明确职业目标岗位',
      detail: '先确定 1–2 个意向岗位，才能生成有针对性的成长计划。可在「能力画像」页补充职业意向后重新生成报告。',
      priority: 'high',
      dueMonth: 1,
      done: false,
    });
    return tasks;
  }

  // ---- 短期：补齐硬门槛 ----
  const mustSkills = match.skillGaps.filter((g) => g.requirement === 'must');
  const mustCerts = match.certGaps.filter((c) => c.requirement === 'must');
  const otherCerts = match.certGaps.filter((c) => c.requirement !== 'must');

  mustSkills.slice(0, 3).forEach((s, i) => {
    tasks.push({
      id: nextId('short'),
      phase: 'short',
      title: `补齐硬技能：${s.name}`,
      detail:
        `「${s.name}」是该岗位明确要求的硬性技能，当前简历中尚未体现。` +
        `建议通过 1 个练手项目完整走一遍（而非只看教程），并在简历中写出可量化的产出（如"独立完成 X 个接口""性能提升 X%"）。`,
      dimension: 'professional_skill',
      relatedItem: s.name,
      priority: 'high',
      dueMonth: Math.min(3, i + 1),
      done: false,
    });
  });

  mustCerts.slice(0, 2).forEach((c, i) => {
    tasks.push({
      id: nextId('short'),
      phase: 'short',
      title: `考取证书：${c.name}`,
      detail: `该岗位将「${c.name}」列为要求，建议纳入本学期考证计划，倒推报名与备考时间。`,
      dimension: 'certificate',
      relatedItem: c.name,
      priority: 'high',
      dueMonth: Math.min(3, i + 2),
      done: false,
    });
  });

  otherCerts.slice(0, 1).forEach((c) => {
    tasks.push({
      id: nextId('short'),
      phase: 'short',
      title: `争取证书：${c.name}`,
      detail: `「${c.name}」属于加分项，行有余力时优先拿下。`,
      dimension: 'certificate',
      relatedItem: c.name,
      priority: 'medium',
      dueMonth: 3,
      done: false,
    });
  });

  // ---- 短期：单维度最短板 ----
  const weakDims = [...match.gaps]
    .filter((g) => g.gap > 0 && !g.insufficientInfo)
    .sort((a, b) => b.gap * b.effectiveWeight - a.gap * a.effectiveWeight);

  const shortDims = weakDims.filter(
    (g) => g.key !== 'professional_skill' && g.key !== 'certificate' && g.key !== 'internship'
  );

  shortDims.slice(0, 1).forEach((g) => {
    tasks.push({
      id: nextId('short'),
      phase: 'short',
      title: `补强${g.label}（当前 ${g.studentScore} → 目标 ${g.requiredScore}）`,
      detail: DIMENSION_ADVICE[g.key],
      dimension: g.key,
      priority: 'medium',
      dueMonth: 3,
      done: false,
    });
  });

  // ---- 中期：实践经历 ----
  const internshipGap = match.gaps.find((g) => g.key === 'internship');
  const needPractice = !internshipGap || internshipGap.gap > 0 || internshipGap.studentScore < 75;

  if (needPractice) {
    tasks.push({
      id: nextId('medium'),
      phase: 'medium',
      title: `获取一段「${match.jobName}」相关的实习或完整项目`,
      detail:
        '实习经历是校招最看重的一项门槛，也是简历上最能拉开差距的部分。' +
        '建议优先找与目标岗位直接相关的实习；若暂时找不到，就用一个功能完整、可演示的个人项目替代，' +
        '并在报告中写清你负责的模块与技术难点。',
      dimension: 'internship',
      priority: 'high',
      dueMonth: 6,
      done: false,
    });
  }

  tasks.push({
    id: nextId('medium'),
    phase: 'medium',
    title: '沉淀一个可展示的作品/项目',
    detail:
      '把课程作业、竞赛作品或实习产出整理成一个可以在面试中完整讲清的项目：' +
      '背景是什么、你解决了什么问题、用了什么技术、结果如何量化。',
    dimension: 'internship',
    priority: 'medium',
    dueMonth: 8,
    done: false,
  });

  // ---- 中期：其余弱项维度 ----
  shortDims.slice(1, 3).forEach((g, i) => {
    tasks.push({
      id: nextId('medium'),
      phase: 'medium',
      title: `提升${g.label}（当前 ${g.studentScore} → 目标 ${g.requiredScore}）`,
      detail: DIMENSION_ADVICE[g.key],
      dimension: g.key,
      priority: 'medium',
      dueMonth: 9 + i,
      done: false,
    });
  });

  // ---- 长期：持续建设与晋升准备 ----
  tasks.push({
    id: nextId('long'),
    phase: 'long',
    title: '建立持续学习的节奏',
    detail:
      '每季度至少完成一项与目标方向相关的新技术或新工具的学习，并留下可验证的产出（笔记、demo、开源提交均可）。' +
      '这是把「学习能力」从自我评价变成可证明事实的方式。',
    dimension: 'learning',
    priority: 'low',
    dueMonth: 18,
    done: false,
  });

  tasks.push({
    id: nextId('long'),
    phase: 'long',
    title: '为晋升到下一级岗位做准备',
    detail:
      '入职后 1–2 年内，除了完成本职工作，主动争取跨模块协作与技术分享的机会，' +
      '积累能体现「独立负责」与「带动他人」的经历——这是从执行岗走向骨干岗的关键。',
    priority: 'low',
    dueMonth: 24,
    done: false,
  });

  return tasks;
};

// ====================== 评估节点 ======================

/** 生成月度/季度评估节点（计划书要求） */
export const buildMilestones = (): EvaluationMilestone[] => [
  {
    month: 1,
    label: '第 1 个月末 · 月度自检',
    focus: '确认短期任务已启动，检查是否有任务根本没开始',
    metrics: ['学习完成率', '专业技能自评分'],
  },
  {
    month: 3,
    label: '第 3 个月末 · 季度复盘',
    focus: '核对硬技能与证书进度，重新生成本报告对比能力画像变化',
    metrics: ['学习完成率', '技能提升度', '综合竞争力评分'],
  },
  {
    month: 6,
    label: '第 6 个月末 · 中期评估',
    focus: '检查实习/项目是否落地，这是最容易被拖延的一项',
    metrics: ['实践成果', '技能提升度', '综合竞争力评分'],
  },
  {
    month: 12,
    label: '第 12 个月末 · 年度总评',
    focus: '全面复算，与目标岗位重新匹配，动态调整下一阶段路径',
    metrics: ['学习完成率', '技能提升度', '实践成果', '综合竞争力评分'],
  },
];

// ====================== 目标与趋势文案 ======================

const buildGoals = (student: StudentProfile, best: MatchResult | null) => {
  if (!best) {
    return {
      shortTerm: '明确 1–2 个意向岗位，并完成一次能力画像自评。',
      longTerm: '在目标方向上形成可展示的能力证明（项目、实习或证书）。',
    };
  }

  const mustSkills = best.skillGaps.filter((g) => g.requirement === 'must').map((g) => g.name);
  const certs = best.certGaps.map((c) => c.name);

  const shortParts: string[] = [];
  if (mustSkills.length) shortParts.push(`补齐「${mustSkills.slice(0, 3).join('、')}」等硬性技能`);
  if (certs.length) shortParts.push(`考取「${certs.slice(0, 2).join('、')}」`);
  if (!shortParts.length && best.gaps.length) {
    const weakest = [...best.gaps].sort((a, b) => b.gap - a.gap)[0];
    shortParts.push(`把「${weakest.label}」从 ${weakest.studentScore} 分提升到 ${weakest.requiredScore} 分以上`);
  }

  const shortTerm = shortParts.length
    ? `3 个月内达到「${best.jobName}」岗位的硬性门槛：${shortParts.join('，')}。`
    : `3 个月内把与「${best.jobName}」的匹配度从 ${best.matchScore}% 提升到 85% 以上。`;

  const longTerm =
    `毕业后进入「${best.jobName}」方向的相关岗位，` +
    `${student.target_industry ? `聚焦${student.target_industry}行业，` : ''}` +
    `并在 3–5 年内沿垂直晋升路径成长到骨干岗位。`;

  return { shortTerm, longTerm };
};

const buildIndustryTrend = (best: MatchResult | null, jobs: JobProfile[]): string => {
  if (!best) {
    return '建议先确定意向行业。聊城市当前重点发展智能制造、现代农业、数字经济三大核心产业，可结合本专业与区域产业需求选择方向。';
  }

  const job = jobs.find((j) => j.job_name === best.jobName);
  const topDims = job
    ? [...job.dimensions].sort((a, b) => b.score - a.score).slice(0, 3).map((d) => d.label)
    : [];

  const industryText = best.industry ? `「${best.industry}」` : '该方向';

  return (
    `${industryText}是聊城市重点培育的核心产业方向之一，相关岗位需求持续增长。` +
    (topDims.length
      ? `从招聘要求看，用人单位在这一岗位上最看重的是${topDims.join('、')}，门槛逐年提高。`
      : '') +
    `建议在补齐硬性要求的同时，持续关注该行业的政策走向与技术演进，` +
    `把这些理解转化为面试中能讲清楚的求职理由——这是很多同学容易忽略、但面试官很在意的部分。`
  );
};

// ====================== Markdown 全文 ======================

const buildMarkdown = (report: CareerReport): string => {
  const { student, bestMatch, matches, careerPath } = report;
  const lines: string[] = [];

  lines.push('# 个性化职业生涯发展报告');
  lines.push('');
  lines.push(`**专业**：${student.major || '未填写'}　**年级**：${student.gradeLabel || '未填写'}`);
  lines.push(`**意向岗位**：${student.targetJob || '未填写'}`);
  lines.push(`**综合就业竞争力评分**：${student.competitiveness} / 100　**信息完整度**：${student.completeness}%`);
  lines.push('');
  lines.push(`**生成时间**：${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 一、匹配分析
  lines.push('## 一、职业探索与人岗匹配分析');
  lines.push('');
  lines.push(report.matchSummary);
  lines.push('');
  if (bestMatch) {
    lines.push('### 1.1 四大维度契合度');
    lines.push('');
    lines.push('| 维度 | 得分 | 权重 |');
    lines.push('| --- | --- | --- |');
    bestMatch.categories.forEach((c) => {
      lines.push(`| ${c.label} | ${c.score} | ${(c.weight * 100).toFixed(0)}% |`);
    });
    lines.push('');

    lines.push('### 1.2 十大能力项差距');
    lines.push('');
    // 统一用「达成度」作为主口径：
    // 专业技能/证书按岗位要求条目覆盖率算，其余按分值比例算，
    // 两者都由 fitPercent 给出，避免同一维度出现两个互相矛盾的数。
    lines.push('| 能力项 | 达成度 | 岗位要求 | 状态 |');
    lines.push('| --- | --- | --- | --- |');
    bestMatch.gaps.forEach((g) => {
      const status = g.noRequirement
        ? '岗位未提要求'
        : g.satisfied
          ? '已达标'
          : g.insufficientInfo
            ? '信息不足'
            : '未达标';

      // 岗位没提要求的项不参与总评，用「—」表示，避免显示成 100% 让人误以为达标
      const achievement = g.noRequirement ? '—' : `${g.fitPercent}%`;

      const requirement = g.noRequirement
        ? '—'
        : g.basis === 'coverage'
          ? g.key === 'professional_skill'
            ? '岗位列明的技能清单'
            : '岗位列明的证书清单'
          : `${g.requiredScore} 分`;

      lines.push(`| ${g.label} | ${achievement} | ${requirement} | ${status} |`);
    });
    lines.push('');
    lines.push(
      '> 达成度说明：专业技能与证书资质按「岗位要求条目中已具备的比例」计算，' +
        '其余能力项按「个人水平 / 岗位要求」计算。岗位未明确提出要求的项不参与总评。'
    );
    lines.push('');

    if (bestMatch.skillGaps.length) {
      lines.push('### 1.3 硬技能缺口');
      lines.push('');
      bestMatch.skillGaps.forEach((s) => {
        lines.push(`- ${s.name}（${s.requirement === 'must' ? '岗位要求' : '加分项'}）`);
      });
      lines.push('');
    }

    if (bestMatch.certGaps.length) {
      lines.push('### 1.4 证书缺口');
      lines.push('');
      bestMatch.certGaps.forEach((c) => lines.push(`- ${c.name}`));
      lines.push('');
    }

    if (matches.length > 1) {
      lines.push('### 1.5 适配岗位排序');
      lines.push('');
      lines.push('| 排名 | 岗位 | 企业 | 匹配度 |');
      lines.push('| --- | --- | --- | --- |');
      matches.slice(0, 5).forEach((m, i) => {
        lines.push(`| ${i + 1} | ${m.jobName} | ${m.enterpriseName || '-'} | ${m.matchScore}% |`);
      });
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('');

  // 二、职业目标与路径
  lines.push('## 二、职业目标与职业路径规划');
  lines.push('');
  lines.push('### 2.1 职业目标');
  lines.push('');
  lines.push(`**短期目标**：${report.shortTermGoal}`);
  lines.push('');
  lines.push(`**长期目标**：${report.longTermGoal}`);
  lines.push('');
  lines.push('### 2.2 行业需求与发展趋势');
  lines.push('');
  lines.push(report.industryTrend);
  lines.push('');

  if (careerPath.verticalPath.length) {
    lines.push('### 2.3 垂直晋升路径');
    lines.push('');
    lines.push('```');
    lines.push(careerPath.verticalPath.join('  →  '));
    lines.push('```');
    lines.push('');
  }

  if (careerPath.lateralPaths.length) {
    lines.push('### 2.4 跨岗换路路径');
    lines.push('');
    lines.push('基于能力要求相似度计算，以下方向属于平滑转岗路径：');
    lines.push('');
    careerPath.lateralPaths.forEach((p, i) => {
      lines.push(`**${i + 1}. ${p.jobName}**（${p.industry || '行业未标注'}，能力相似度 ${Math.round(p.similarity * 100)}%）`);
      lines.push('');
      lines.push(`> ${p.reason}`);
      lines.push('');
    });
  }
  lines.push('---');
  lines.push('');

  // 三、成长计划
  lines.push('## 三、分阶段个性化成长计划');
  lines.push('');
  (['short', 'medium', 'long'] as PlanPhase[]).forEach((phase) => {
    const phaseTasks = report.tasks.filter((t) => t.phase === phase);
    if (!phaseTasks.length) return;
    lines.push(`### ${PLAN_PHASE_LABEL[phase]}`);
    lines.push('');
    phaseTasks.forEach((t) => {
      lines.push(`- [${t.done ? 'x' : ' '}] **${t.title}**　\`${TASK_PRIORITY_LABEL[t.priority]} · 第 ${t.dueMonth} 个月\``);
      lines.push(`  ${t.detail}`);
    });
    lines.push('');
  });
  lines.push('---');
  lines.push('');

  // 四、评估机制
  lines.push('## 四、评估周期与动态调整机制');
  lines.push('');
  lines.push('| 评估节点 | 复盘重点 | 核心指标 |');
  lines.push('| --- | --- | --- |');
  report.milestones.forEach((m) => {
    lines.push(`| ${m.label} | ${m.focus} | ${m.metrics.join('、')} |`);
  });
  lines.push('');
  lines.push('每次复盘后，重新生成本报告并与上一版对比，动态调整成长路径。');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('> 本报告由「职途智行」根据能力画像与人岗匹配结果自动生成，仅供生涯规划参考，不作为招聘录用依据。');

  return lines.join('\n');
};

// ====================== 主入口 ======================

/**
 * 生成个性化职业生涯发展报告。
 *
 * @param student 学生能力画像（功能 2 的产物）
 * @param jobs 岗位画像集合（功能 1 的产物）
 * @param options 配置
 */
export const buildCareerReport = (
  student: StudentProfile,
  jobs: JobProfile[],
  options: BuildReportOptions = {}
): CareerReport => {
  const { topN = 5, studentName = '', previousTasks } = options;

  // 1) 匹配（功能 3）
  const allMatches = rankJobsByMatch(student, jobs);
  const matches = allMatches.slice(0, topN);
  const bestMatch = matches[0] ?? null;

  // 2) 岗位图谱（核心创新）
  const graph = buildJobGraph(jobs);
  const node = bestMatch ? graph.find((n) => n.jobName === bestMatch.jobName) : undefined;

  const careerPath = {
    currentJob: bestMatch?.jobName ?? '',
    verticalPath: node?.verticalPath ?? [],
    lateralPaths: (node?.lateralPaths ?? []).map((p) => ({
      jobId: p.jobId,
      jobName: p.jobName,
      industry: p.industry,
      similarity: p.similarity,
      reason: p.reason,
    })),
  };

  // 3) 目标与趋势
  const { shortTerm, longTerm } = buildGoals(student, bestMatch);
  const industryTrend = buildIndustryTrend(bestMatch, jobs);

  // 4) 成长计划（保留上次的勾选进度）
  const freshTasks = buildGrowthTasks(bestMatch);
  const tasks = previousTasks?.length
    ? freshTasks.map((t) => ({
        ...t,
        done: previousTasks.find((p) => p.title === t.title)?.done ?? t.done,
      }))
    : freshTasks;

  // 5) 匹配分析结论
  const matchSummary = bestMatch
    ? (() => {
        const parts = [
          `本次共比对 ${allMatches.length} 个岗位，与你的能力画像匹配度最高的是「${bestMatch.jobName}」` +
            `${bestMatch.enterpriseName ? `（${bestMatch.enterpriseName}）` : ''}，综合匹配度 ${bestMatch.matchScore}%，${bestMatch.matchLevelLabel}。`,
        ];
        if (bestMatch.criticalGaps.length) {
          parts.push(`主要差距集中在：${bestMatch.criticalGaps.join('；')}。`);
        } else {
          parts.push('未发现明显短板，建议尽快投递并把相关经历写得更具体。');
        }
        parts.push(`十大能力项中已有 ${bestMatch.satisfiedCount}/${bestMatch.totalCount} 项达到该岗位要求。`);
        return parts.join('');
      })()
    : '暂无可匹配的岗位数据，请先在岗位画像模块生成岗位后再生成报告。';

  // 6) 组装
  const report: CareerReport = {
    id: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    student: {
      name: studentName,
      major: student.major,
      gradeLabel: student.grade_label,
      targetJob: student.target_job,
      competitiveness: student.competitiveness,
      completeness: student.completeness,
    },
    bestMatch,
    matches,
    matchSummary,
    shortTermGoal: shortTerm,
    longTermGoal: longTerm,
    industryTrend,
    careerPath,
    tasks,
    milestones: buildMilestones(),
    markdown: '',
    parseMethod: (bestMatch?.isRuleBased ?? true) ? ('rule' as ParseSource) : ('qwen' as ParseSource),
    sourceStudentParsedAt: student.parsed_at ?? '',
    confidence: Number(
      (
        (student.confidence + (bestMatch?.confidence ?? student.confidence)) /
        2
      ).toFixed(2)
    ),
  };

  report.markdown = buildMarkdown(report);
  return report;
};

/** 重新生成 Markdown（用户编辑目标后需要同步全文） */
export const refreshReportMarkdown = (report: CareerReport): CareerReport => ({
  ...report,
  markdown: buildMarkdown(report),
});

export { CAREER_REPORT_STORAGE_KEY };
export type { CareerReport };
