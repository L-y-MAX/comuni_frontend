/**
 * 个性化职业生涯发展报告 —— 数据模型
 *
 * 对应计划书《职途智行》核心功能板块(4)，报告必须包含五个部分：
 *   1. 职业探索与人岗匹配分析 —— 量化呈现契合度与差距，明确适配岗位与优化方向
 *   2. 职业目标设定与职业路径规划 —— 结合匹配结果与个人意愿，给出清晰晋升路径
 *   3. 分阶段个性化成长计划 —— 短期（1–3个月）、中期（4–12个月）可执行方案
 *   4. 评估周期与动态调整机制 —— 月度/季度评估节点，以学习完成率、技能提升度、
 *      实践成果、竞争力评分为核心指标，定期复盘并动态优化
 *   5. 报告编辑与导出 —— 支持手动修改职业目标与成长计划，一键导出 PDF/Word
 *
 * 设计要点：
 *   - 报告是**前三个功能的汇聚点**：吃进人岗匹配结果、岗位图谱与能力画像；
 *   - 任务（成长计划）带 `done` 字段，支持勾选追踪 —— 这是"可执行、可追踪"的落点；
 *   - 报告同时产出结构化数据（供界面渲染）与 Markdown 全文（供复制/导出/存档），
 *     两者由同一份数据生成，保证内容一致。
 */

import type { AbilityDimensionKey, ParseSource } from './jobProfile';
import type { MatchResult } from './jobMatch';

// ====================== 成长计划任务 ======================

/** 计划阶段 */
export type PlanPhase = 'short' | 'medium' | 'long';

export const PLAN_PHASE_LABEL: Record<PlanPhase, string> = {
  short: '短期（1–3个月）',
  medium: '中期（4–12个月）',
  long: '长期（1年以上）',
};

export const PLAN_PHASE_RANGE: Record<PlanPhase, string> = {
  short: '第 1–3 个月',
  medium: '第 4–12 个月',
  long: '第 13 个月起',
};

export type TaskPriority = 'high' | 'medium' | 'low';

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: '高优先',
  medium: '中优先',
  low: '持续进行',
};

export interface GrowthTask {
  id: string;
  phase: PlanPhase;
  title: string;
  detail: string;
  /** 关联的能力维度 */
  dimension?: AbilityDimensionKey;
  /** 关联的具体技能/证书名称 */
  relatedItem?: string;
  priority: TaskPriority;
  /** 建议完成月份（第几个月） */
  dueMonth: number;
  /** 是否已完成（用户可勾选） */
  done: boolean;
}

// ====================== 评估节点 ======================

export interface EvaluationMilestone {
  /** 第几个月 */
  month: number;
  label: string;
  /** 复盘重点 */
  focus: string;
  /** 核心指标（计划书要求：学习完成率、技能提升度、实践成果、竞争力评分） */
  metrics: string[];
}

// ====================== 职业路径 ======================

export interface LateralPathBrief {
  jobId: string;
  jobName: string;
  industry: string;
  similarity: number;
  reason: string;
}

export interface CareerPath {
  /** 当前目标岗位 */
  currentJob: string;
  /** 垂直晋升路径 */
  verticalPath: string[];
  /** 跨岗换路路径 */
  lateralPaths: LateralPathBrief[];
}

// ====================== 报告主体 ======================

export interface ReportStudentSnapshot {
  name: string;
  major: string;
  gradeLabel: string;
  targetJob: string;
  /** 综合就业竞争力评分 */
  competitiveness: number;
  /** 信息完整度 */
  completeness: number;
}

export interface CareerReport {
  /** 报告标识（用于本地存储与导出请求） */
  id: string;
  generatedAt: string;
  student: ReportStudentSnapshot;

  // ---- 1. 职业探索与人岗匹配分析 ----
  /** 最佳匹配岗位（无匹配结果时为 null） */
  bestMatch: MatchResult | null;
  /** 参与分析的岗位匹配结果（按匹配度降序） */
  matches: MatchResult[];
  /** 匹配分析结论 */
  matchSummary: string;

  // ---- 2. 职业目标与职业路径规划 ----
  /** 短期目标（用户可编辑） */
  shortTermGoal: string;
  /** 长期目标（用户可编辑） */
  longTermGoal: string;
  /** 行业需求与趋势分析 */
  industryTrend: string;
  /** 岗位图谱路径 */
  careerPath: CareerPath;

  // ---- 3. 分阶段个性化成长计划 ----
  tasks: GrowthTask[];

  // ---- 4. 评估周期与动态调整机制 ----
  milestones: EvaluationMilestone[];

  // ---- 5. 导出 ----
  /** 报告全文（Markdown），供复制、导出与存档 */
  markdown: string;

  /** 生成方式（本地规则 / 大模型） */
  parseMethod: ParseSource;
  /** 数据可靠性说明（两侧画像的解析置信度均值） */
  confidence: number;

  /**
   * 生成本报告时所依据的「学生能力画像」的生成时间戳（student.parsed_at）。
   *
   * 用途：判断缓存是否过期。
   * 之前页面只判断「本地有没有缓存」，有就直接显示，导致用户改完能力画像
   * 再进来看到的还是旧报告，且没有任何提示。有了这个指纹就能自动识别：
   * 指纹不一致 → 底层数据已更新 → 重新计算（同时保留任务勾选进度）。
   */
  sourceStudentParsedAt: string;
}

// ====================== 统计辅助 ======================

/** 任务完成情况统计 */
export interface TaskProgress {
  total: number;
  done: number;
  /** 完成率 0-100 */
  percent: number;
  byPhase: Record<PlanPhase, { total: number; done: number }>;
}

export const calcTaskProgress = (tasks: GrowthTask[]): TaskProgress => {
  const byPhase: TaskProgress['byPhase'] = {
    short: { total: 0, done: 0 },
    medium: { total: 0, done: 0 },
    long: { total: 0, done: 0 },
  };

  let done = 0;
  tasks.forEach((t) => {
    byPhase[t.phase].total += 1;
    if (t.done) {
      byPhase[t.phase].done += 1;
      done += 1;
    }
  });

  return {
    total: tasks.length,
    done,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    byPhase,
  };
};

/** 存储键：报告与任务完成状态保存在本地 */
export const CAREER_REPORT_STORAGE_KEY = 'careerReport';
