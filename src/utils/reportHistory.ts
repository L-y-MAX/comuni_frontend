/**
 * 生涯发展报告 —— 历史记录
 *
 * 需求来源：用户需要回看之前生成的报告，对比能力变化与计划完成情况。
 *
 * 设计取舍：
 *   1. **存完整报告**而不是只存指标。历史详情要能原样重现（含 Markdown 全文可导出），
 *      只存指标的话点进去还得重算，而重算出来的并不是当时那一版，就失去"历史"的意义了。
 *      单份报告约 4-6KB，保留 10 份 ≈ 60KB，远低于小程序 10MB 的本地存储上限。
 *   2. **按 id 去重**：同一份报告重复保存时覆盖，不产生重复条目。
 *   3. **新的在前**：列表按生成时间倒序，符合"看最近一次"的高频诉求。
 */

import type { CareerReport } from '@/types/careerReport';
import { calcTaskProgress } from '@/types/careerReport';

/** 历史记录存储键 */
export const REPORT_HISTORY_STORAGE_KEY = 'careerReportHistory';

/** 最多保留多少份历史（超出后丢弃最旧的） */
export const REPORT_HISTORY_MAX = 10;

/** 报告快照指标 —— 列表展示与趋势对比用，避免为了显示一行摘要解析整份报告 */
export interface ReportSnapshot {
  competitiveness: number;
  completeness: number;
  bestJobName: string;
  bestMatchScore: number;
  taskDone: number;
  taskTotal: number;
}

export interface ReportHistoryEntry {
  id: string;
  /** 生成时间（ISO） */
  generatedAt: string;
  /** 能力画像是否由本地规则解析得来（用于列表上标注可信度） */
  ruleBased: boolean;
  snapshot: ReportSnapshot;
  /** 完整报告，供详情与原样导出 */
  report: CareerReport;
}

// ====================== 读 / 写 ======================

const readRaw = (): ReportHistoryEntry[] => {
  try {
    const raw = uni.getStorageSync(REPORT_HISTORY_STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    // 过滤掉结构不完整的条目，避免脏数据让整个列表崩掉
    return raw.filter(
      (e): e is ReportHistoryEntry =>
        !!e && typeof e === 'object' && !!e.id && !!e.report && !!e.snapshot
    );
  } catch {
    return [];
  }
};

const writeRaw = (list: ReportHistoryEntry[]) => {
  try {
    uni.setStorageSync(REPORT_HISTORY_STORAGE_KEY, list);
  } catch (err) {
    // 存储写满等异常不应该阻断主流程
    console.error('写入报告历史失败：', err);
  }
};

/** 从报告生成快照 */
export const buildSnapshot = (report: CareerReport): ReportSnapshot => {
  const progress = calcTaskProgress(report.tasks);
  return {
    competitiveness: report.student.competitiveness,
    completeness: report.student.completeness,
    bestJobName: report.bestMatch?.jobName ?? '',
    bestMatchScore: report.bestMatch?.matchScore ?? 0,
    taskDone: progress.done,
    taskTotal: progress.total,
  };
};

/** 报告 → 历史条目 */
export const toHistoryEntry = (report: CareerReport): ReportHistoryEntry => ({
  id: report.id,
  generatedAt: report.generatedAt,
  ruleBased: report.parseMethod === 'rule',
  snapshot: buildSnapshot(report),
  report,
});

/** 取全部历史（新的在前） */
export const loadReportHistory = (): ReportHistoryEntry[] => readRaw();

/** 取指定历史 */
export const getHistoryEntry = (id: string): ReportHistoryEntry | null =>
  readRaw().find((e) => e.id === id) ?? null;

/**
 * 保存一份报告到历史。
 * 同一 id 覆盖；返回保存后的完整列表。
 */
export const pushReportHistory = (report: CareerReport): ReportHistoryEntry[] => {
  const entry = toHistoryEntry(report);
  const rest = readRaw().filter((e) => e.id !== entry.id);
  const next = [entry, ...rest]
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    .slice(0, REPORT_HISTORY_MAX);
  writeRaw(next);
  return next;
};

/** 更新某条历史里的报告（用于同步任务勾选进度） */
export const updateHistoryEntry = (report: CareerReport): ReportHistoryEntry[] => {
  const list = readRaw();
  const idx = list.findIndex((e) => e.id === report.id);
  if (idx === -1) return pushReportHistory(report);
  list[idx] = toHistoryEntry(report);
  writeRaw(list);
  return list;
};

/** 删除一条历史 */
export const removeHistoryEntry = (id: string): ReportHistoryEntry[] => {
  const next = readRaw().filter((e) => e.id !== id);
  writeRaw(next);
  return next;
};

/** 清空历史 */
export const clearReportHistory = (): void => {
  try {
    uni.removeStorageSync(REPORT_HISTORY_STORAGE_KEY);
  } catch {
    // 忽略
  }
};

// ====================== 趋势对比 ======================

export interface HistoryTrend {
  /** 与上一版相比的竞争力变化（正数为进步） */
  competitivenessDelta: number;
  /** 与上一版相比的完成率变化（百分点） */
  progressDelta: number;
  /** 是否发生了能力提升 */
  improved: boolean;
}

/**
 * 计算某条历史相对上一版的变化。
 * 历史列表按时间倒序，因此"上一版"是数组里索引 +1 的那条。
 */
export const calcTrend = (
  list: ReportHistoryEntry[],
  index: number
): HistoryTrend | null => {
  const current = list[index];
  const previous = list[index + 1];
  if (!current || !previous) return null;

  const pct = (e: ReportHistoryEntry) =>
    e.snapshot.taskTotal ? Math.round((e.snapshot.taskDone / e.snapshot.taskTotal) * 100) : 0;

  const competitivenessDelta =
    current.snapshot.competitiveness - previous.snapshot.competitiveness;
  const progressDelta = pct(current) - pct(previous);

  return {
    competitivenessDelta,
    progressDelta,
    improved: competitivenessDelta > 0 || progressDelta > 0,
  };
};
