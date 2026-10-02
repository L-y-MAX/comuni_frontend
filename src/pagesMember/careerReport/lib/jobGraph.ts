/**
 * 岗位图谱 —— 垂直晋升 + 跨岗换路
 *
 * 对应计划书《职途智行》「核心创新·岗位图谱创新」：
 *   - 垂直晋升图谱：明确岗位发展路径，如 开发工程师→高级开发→技术主管→技术总监
 *   - 换岗路径图谱：**基于能力相似度**设计跨岗转换路线，
 *     为至少 5 类核心岗位各提供 2 条以上平滑转岗路径
 *
 * 岗位画像里已经带了 `promotion_path`（垂直晋升链），这里补的是**跨岗换路**。
 *
 * ## 相似度为什么要"结构 + 内容"两条腿
 *
 * 只用「要求结构」相似度（十维向量的相关系数）会得出反直觉的结论：
 * Java开发 与 机械设计 的十维要求形状几乎一样（都是"专业技能要求高、实习要求高、
 * 其他中等"），相关系数高达 0.9，于是被判成"高度相似可平滑转岗"——
 * 但这两者的**专业技能内容**一个是编程框架、一个是机械制图，根本不可迁移。
 *
 * 所以这里把相似度拆成两部分加权：
 *   结构相似度：十维要求的形状像不像（相关系数）→ 回答"要求的**类型**像不像"
 *   内容相似度：两岗位的技能/证书集合重合率     → 回答"要的**东西**是不是一回事"
 *
 * 并且为每条路径标注**迁移平滑度**：
 *   smooth   平滑转岗：内容重合充分，现有技能可直接复用
 *   moderate 可过渡：结构相近、部分技能可复用，需补一部分知识
 *   stretch  跨领域：结构相近但内容几乎不重合，需要系统补专业基础
 *
 * 这样既满足计划书"每个岗位给出转岗路径"的要求，又不会把跨领域转向包装成"平滑转岗"。
 */

import type { AbilityDimensionKey, JobProfile } from '@/types/jobProfile';
import { JOB_DIMENSIONS } from '@/types/jobProfile';

// ====================== 类型 ======================

/** 迁移平滑度 */
export type TransferSmoothness = 'smooth' | 'moderate' | 'stretch';

export const SMOOTHNESS_LABEL: Record<TransferSmoothness, string> = {
  smooth: '平滑转岗',
  moderate: '可过渡',
  stretch: '跨领域转向',
};

export interface LateralPath {
  jobId: string;
  jobName: string;
  enterpriseName: string;
  industry: string;
  /** 综合相似度 0-1（结构 + 内容加权） */
  similarity: number;
  /** 结构相似度（十维要求形状） */
  shapeSimilarity: number;
  /** 内容相似度（技能/证书集合重合率） */
  contentSimilarity: number;
  /** 迁移平滑度 */
  smoothness: TransferSmoothness;
  /** 两岗位共同要求的技能/证书（可直接迁移的部分） */
  sharedItems: string[];
  /** 相似度高且都要求不低的维度 */
  transferableDimensions: AbilityDimensionKey[];
  /** 目标岗位要求明显更高、需要补的维度 */
  gapDimensions: AbilityDimensionKey[];
  /** 换岗说明（人话） */
  reason: string;
}

export interface JobGraphNode {
  jobId: string;
  jobName: string;
  enterpriseName: string;
  industry: string;
  /** 垂直晋升链 */
  verticalPath: string[];
  /** 跨岗换路（按相似度降序） */
  lateralPaths: LateralPath[];
}

// ====================== 相似度 ======================

/** 取岗位的十维要求向量（顺序固定为 JOB_DIMENSIONS 顺序） */
export const jobVector = (job: JobProfile): number[] =>
  JOB_DIMENSIONS.map((meta) => job.dimensions.find((d) => d.key === meta.key)?.score ?? 0);

const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

/**
 * 结构相似度：去均值后的余弦相似度（即皮尔逊相关系数），映射到 [0,1]。
 *
 * 必须去均值：十维分值全是正数且量级接近（大多 50~100），
 * 原始余弦会被压到 0.95 以上，任何两个岗位都"高度相似"，完全没有区分度。
 * 去均值后衡量的是**要求形状**（哪几维高、哪几维低）。
 */
export const calcShapeSimilarity = (a: JobProfile, b: JobProfile): number => {
  const va = jobVector(a);
  const vb = jobVector(b);
  const ma = mean(va);
  const mb = mean(vb);

  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < va.length; i += 1) {
    const da = va[i] - ma;
    const db = vb[i] - mb;
    dot += da * db;
    na += da * da;
    nb += db * db;
  }
  if (na === 0 || nb === 0) return 0;

  const r = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return Number(((r + 1) / 2).toFixed(4));
};

/** 取岗位要求的技能 + 证书名称集合（小写） */
const itemSet = (job: JobProfile): Set<string> => {
  const skills = job.dimensions.find((d) => d.key === 'professional_skill')?.skills ?? [];
  const certs = job.dimensions.find((d) => d.key === 'certificate')?.certificates ?? [];
  return new Set([...skills.map((s) => s.name), ...certs.map((c) => c.name)].map((n) => n.toLowerCase()));
};

/** 取两岗位共同要求的具体条目（保留原始大小写，用于展示） */
export const sharedItems = (a: JobProfile, b: JobProfile): string[] => {
  const setB = itemSet(b);
  const skills = a.dimensions.find((d) => d.key === 'professional_skill')?.skills ?? [];
  const certs = a.dimensions.find((d) => d.key === 'certificate')?.certificates ?? [];
  return [...skills.map((s) => s.name), ...certs.map((c) => c.name)].filter((n) =>
    setB.has(n.toLowerCase())
  );
};

/**
 * 内容相似度：两岗位技能/证书集合的重合率。
 * 分母取较小集合的大小 —— 一个专精岗位的整套要求被另一个大岗位覆盖时，
 * 应视为高度可迁移，而不是被大岗位的规模稀释。
 */
export const calcContentSimilarity = (a: JobProfile, b: JobProfile): number => {
  const sa = itemSet(a);
  const sb = itemSet(b);
  if (!sa.size || !sb.size) return 0;

  let inter = 0;
  sa.forEach((x) => {
    if (sb.has(x)) inter += 1;
  });
  return Number((inter / Math.min(sa.size, sb.size)).toFixed(4));
};

/** 结构 / 内容在综合相似度中的权重 */
export const SHAPE_WEIGHT = 0.5;
export const CONTENT_WEIGHT = 0.5;

/** 综合相似度 */
export const calcJobSimilarity = (a: JobProfile, b: JobProfile): number =>
  Number(
    (SHAPE_WEIGHT * calcShapeSimilarity(a, b) + CONTENT_WEIGHT * calcContentSimilarity(a, b)).toFixed(4)
  );

/** 依据内容重合率判定迁移平滑度 */
export const smoothnessOf = (contentSimilarity: number): TransferSmoothness => {
  if (contentSimilarity >= 0.2) return 'smooth';
  if (contentSimilarity >= 0.05) return 'moderate';
  return 'stretch';
};

// ====================== 维度分析 ======================

/** 相似度高且两边都不低的维度 → 视为要求类型相近、能力可迁移 */
const findTransferableDimensions = (
  from: JobProfile,
  to: JobProfile,
  diffThreshold = 8
): AbilityDimensionKey[] =>
  JOB_DIMENSIONS.filter((meta) => {
    const s = from.dimensions.find((d) => d.key === meta.key)?.score ?? 0;
    const t = to.dimensions.find((d) => d.key === meta.key)?.score ?? 0;
    return Math.abs(s - t) <= diffThreshold && s >= 60 && t >= 60;
  })
    .map((meta) => meta.key)
    .slice(0, 4);

/** 目标岗位要求明显更高、需要补的维度 */
const findGapDimensions = (
  from: JobProfile,
  to: JobProfile,
  gapThreshold = 12
): AbilityDimensionKey[] =>
  JOB_DIMENSIONS.filter((meta) => {
    const s = from.dimensions.find((d) => d.key === meta.key)?.score ?? 0;
    const t = to.dimensions.find((d) => d.key === meta.key)?.score ?? 0;
    return t - s > gapThreshold;
  })
    .map((meta) => meta.key)
    .slice(0, 3);

const dimLabel = (job: JobProfile, key: AbilityDimensionKey): string =>
  job.dimensions.find((d) => d.key === key)?.label ?? key;

/** 生成换岗说明：按平滑度给不同措辞，不把跨领域包装成平滑转岗 */
const buildReason = (
  from: JobProfile,
  to: JobProfile,
  smoothness: TransferSmoothness,
  shared: string[],
  gaps: AbilityDimensionKey[],
  similarity: number
): string => {
  const percent = Math.round(similarity * 100);
  const gapText = gaps.length
    ? `需要补的是「${gaps.map((k) => dimLabel(to, k)).join('、')}」`
    : '各维度要求基本对得上';

  if (smoothness === 'smooth') {
    const sharedText = shared.length
      ? `两者都要求「${shared.slice(0, 5).join('、')}」等能力，现有技能可以直接复用`
      : `两者能力要求高度重合（相似度 ${percent}%）`;
    return `${sharedText}；${gapText}。属于平滑转岗路径，转型成本较低。`;
  }

  if (smoothness === 'moderate') {
    const sharedText = shared.length
      ? `两者在「${shared.slice(0, 4).join('、')}」上有交集，这部分可以直接复用`
      : `两者能力要求结构相近（相似度 ${percent}%）`;
    return `${sharedText}，但具体专业知识有差异；${gapText}。属于可过渡路径，建议边做边补。`;
  }

  return (
    `两者对能力**类型**的要求相近（相似度 ${percent}%），但具体专业技能几乎没有重叠` +
    `（「${from.job_name}」偏${dimLabel(from, 'professional_skill')}方向，「${to.job_name}」偏另一套技术栈）；` +
    `${gapText}。这属于**跨领域转向**，需要系统补足专业基础，不适合当作短期备选。`
  );
};

// ====================== 图谱构建 ======================

export interface BuildJobGraphOptions {
  /** 每个岗位保留几条跨岗路径（计划书要求 ≥2 条） */
  lateralCount?: number;
}

/**
 * 为一组岗位构建岗位图谱。
 *
 * 说明：这里**不设相似度硬阈值**，而是每个岗位固定取相似度最高的前 N 个，
 * 再用 `smoothness` 标注这条路径到底有多"平滑"。
 * 原因：硬阈值会让冷门方向的岗位一条路径都拿不到（计划书要求每类岗位都有 ≥2 条），
 * 而标注平滑度既保证了覆盖，又不至于误导用户。
 */
export const buildJobGraph = (
  jobs: JobProfile[],
  options: BuildJobGraphOptions = {}
): JobGraphNode[] => {
  const { lateralCount = 2 } = options;

  return jobs.map((job) => {
    const lateralPaths: LateralPath[] = jobs
      .filter((other) => other.recruitment_id !== job.recruitment_id)
      .map((other) => {
        const shapeSimilarity = calcShapeSimilarity(job, other);
        const contentSimilarity = calcContentSimilarity(job, other);
        const similarity = Number(
          (SHAPE_WEIGHT * shapeSimilarity + CONTENT_WEIGHT * contentSimilarity).toFixed(4)
        );
        const shared = sharedItems(job, other);
        const transferableDimensions = findTransferableDimensions(job, other);
        const gapDimensions = findGapDimensions(job, other);
        const smoothness = smoothnessOf(contentSimilarity);

        return {
          jobId: other.recruitment_id,
          jobName: other.job_name,
          enterpriseName: other.enterprise_name,
          industry: other.industry,
          similarity,
          shapeSimilarity,
          contentSimilarity,
          smoothness,
          sharedItems: shared,
          transferableDimensions,
          gapDimensions,
          reason: buildReason(job, other, smoothness, shared, gapDimensions, similarity),
        };
      })
      // 结构相近但内容完全不重合的跨领域方向排在平滑路径之后
      .sort((a, b) => {
        const rank = (s: TransferSmoothness) => (s === 'smooth' ? 0 : s === 'moderate' ? 1 : 2);
        const diff = rank(a.smoothness) - rank(b.smoothness);
        return diff !== 0 ? diff : b.similarity - a.similarity;
      })
      .slice(0, lateralCount);

    return {
      jobId: job.recruitment_id,
      jobName: job.job_name,
      enterpriseName: job.enterprise_name,
      industry: job.industry,
      verticalPath: job.promotion_path,
      lateralPaths,
    };
  });
};

/** 按岗位标识取图谱节点 */
export const findJobGraphNode = (
  nodes: JobGraphNode[],
  jobId: string
): JobGraphNode | undefined => nodes.find((n) => n.jobId === jobId);
