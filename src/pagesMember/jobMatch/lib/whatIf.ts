/**
 * 补差模拟（What-if）
 *
 * 只做一件事：把「如果补上某项技能/证书，或某一维提升 10 分」应用到学生画像的副本上，
 * 再用同一套 matchStudentToJob 重新计算，得到预计分数。
 *
 * 不使用「原分数 + 经验值」的假算法——门槛封顶、扣分、信息不足都会让分数非线性，
 * 必须完整重算，结果才和真实匹配一致。
 */

import { scoreToLevel, type JobProfile } from '@/types/jobProfile'
import type { StudentProfile } from '@/types/studentProfile'
import { matchStudentToJob } from './jobMatch'
import type { MatchResult } from './jobMatchTypes'

export type WhatIfKind = 'skill' | 'certificate' | 'dimension'

export interface WhatIfOption {
  id: string
  kind: WhatIfKind
  name: string
  /** 技能/证书的岗位要求强度 */
  requirement?: 'must' | 'preferred'
  /** 维度模拟时的维度 key */
  dimension?: string
  /** 单项预计提升（0 表示受门槛/封顶限制，分数不变） */
  delta: number
  /** 单项模拟后的分数 */
  nextScore: number
}

export interface WhatIfPlanItem {
  id: string
  name: string
  kind: WhatIfKind
  requirement?: 'must' | 'preferred'
  delta: number
}

export interface WhatIfPlan {
  jobId: string
  jobName: string
  baseScore: number
  simulatedScore: number
  items: WhatIfPlanItem[]
  createdAt: number
}

export const WHAT_IF_PLAN_KEY = 'jobMatchWhatIfPlans'

const cloneProfile = (profile: StudentProfile): StudentProfile =>
  JSON.parse(JSON.stringify(profile)) as StudentProfile

const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

/** 把一项模拟应用到学生画像，返回新画像（不改原对象） */
export function applyWhatIfOption(
  student: StudentProfile,
  option: WhatIfOption,
): StudentProfile {
  const next = cloneProfile(student)

  if (option.kind === 'skill') {
    const dim = next.dimensions.find((d) => d.key === 'professional_skill')
    if (!dim) return next
    const exists = (dim.skills ?? []).some(
      (s) => s.name.toLowerCase() === option.name.toLowerCase(),
    )
    if (!exists) {
      dim.skills = [...(dim.skills ?? []), { name: option.name, proficiency: 'basic' }]
    }
    return next
  }

  if (option.kind === 'certificate') {
    const dim = next.dimensions.find((d) => d.key === 'certificate')
    if (!dim) return next
    const exists = (dim.certificates ?? []).some(
      (c) => c.name.toLowerCase() === option.name.toLowerCase(),
    )
    if (!exists) {
      dim.certificates = [...(dim.certificates ?? []), { name: option.name }]
    }
    return next
  }

  const dim = next.dimensions.find((d) => d.key === option.dimension)
  if (dim) {
    dim.score = clampScore(dim.score + 10)
    dim.level = scoreToLevel(dim.score)
  }
  return next
}

/** 把多选项依次应用到副本，得到最终画像与匹配结果 */
export function simulateWhatIf(
  student: StudentProfile,
  job: JobProfile,
  options: WhatIfOption[],
): { student: StudentProfile; match: MatchResult } {
  let next = cloneProfile(student)
  for (const option of options) {
    next = applyWhatIfOption(next, option)
  }
  return { student: next, match: matchStudentToJob(next, job) }
}

/**
 * 生成候选项并计算单项提升。
 *
 * 候选来源：
 *   1. 岗位要求但学生未体现的技能（必须/优先）；
 *   2. 岗位要求但学生未体现的证书；
 *   3. 岗位有要求、学生未达标、且按分值口径计算的维度（+10 分模拟）。
 */
export function buildWhatIfOptions(
  student: StudentProfile,
  job: JobProfile,
  base: MatchResult,
): WhatIfOption[] {
  const candidates: WhatIfOption[] = []

  for (const gap of base.skillGaps) {
    if (gap.possessed) continue
    candidates.push({
      id: `skill:${gap.name}`,
      kind: 'skill',
      name: gap.name,
      requirement: gap.requirement,
      delta: 0,
      nextScore: 0,
    })
  }

  for (const gap of base.certGaps) {
    if (gap.possessed) continue
    candidates.push({
      id: `cert:${gap.name}`,
      kind: 'certificate',
      name: gap.name,
      requirement: gap.requirement,
      delta: 0,
      nextScore: 0,
    })
  }

  for (const gap of base.gaps) {
    if (gap.noRequirement || gap.satisfied || gap.basis !== 'score') continue
    if (gap.studentScore >= 95) continue
    candidates.push({
      id: `dim:${gap.key}`,
      kind: 'dimension',
      name: gap.label,
      dimension: gap.key,
      delta: 0,
      nextScore: 0,
    })
  }

  const seen = new Set<string>()
  return candidates
    .filter((opt) => {
      if (seen.has(opt.id)) return false
      seen.add(opt.id)
      return true
    })
    .map((opt) => {
      const { match } = simulateWhatIf(student, job, [opt])
      return {
        ...opt,
        delta: Math.max(0, match.matchScore - base.matchScore),
        nextScore: match.matchScore,
      }
    })
    .sort((a, b) => {
      if (b.delta !== a.delta) return b.delta - a.delta
      if (a.requirement === 'must' && b.requirement !== 'must') return -1
      if (b.requirement === 'must' && a.requirement !== 'must') return 1
      return a.name.localeCompare(b.name)
    })
}

/** 读取本地补差计划（最多保留 5 条，同一岗位覆盖） */
export function readWhatIfPlans(): WhatIfPlan[] {
  try {
    const raw = uni.getStorageSync(WHAT_IF_PLAN_KEY)
    return Array.isArray(raw) ? (raw as WhatIfPlan[]) : []
  } catch {
    return []
  }
}

export function saveWhatIfPlan(plan: WhatIfPlan): WhatIfPlan[] {
  const plans = readWhatIfPlans().filter((p) => p.jobId !== plan.jobId)
  const next = [plan, ...plans].slice(0, 5)
  uni.setStorageSync(WHAT_IF_PLAN_KEY, next)
  return next
}

export function clearWhatIfPlans(): void {
  uni.removeStorageSync(WHAT_IF_PLAN_KEY)
}
