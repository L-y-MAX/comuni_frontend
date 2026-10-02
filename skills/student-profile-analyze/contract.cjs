/**
 * 学生画像解析结果的校验器（服务端与自测共用）。
 *
 * 校验顺序（任何一步失败都会体现在 errors 里，由调用方决定是否降级）：
 *   1. 结构：十维齐全、不许多余、类型与范围正确
 *   2. 语义：evidence 必须是输入原文的子串（防幻觉的核心一条）
 *   3. 一致性：level 与 score 的档位是否吻合（不吻合只告警，不判错）
 *
 * 设计口径：**能修的修，不能修的报告**。
 *   - evidence 编造 -> 丢弃该条；该维度全部被丢弃 -> confidence 压到 0.3
 *   - 维度缺失     -> 补中性分 50 / confidence 0.3（并在 normalized.missing 里记账）
 *   - 维度多余     -> 丢弃（记账）
 * 这样既不会把"差一点"的结果整条废掉，也不会让编造的内容混进去。
 */
const fs = require('fs')
const path = require('path')

const DIM_FILE = path.join(__dirname, '..', '_shared', 'dimensions.json')

/** 允许的输入字段（与 StudentProfileInput 对齐） */
const INPUT_FIELDS = [
  'major',
  'grade',
  'target_job',
  'target_industry',
  'skills_text',
  'certificates_text',
  'internship_text',
  'projects_text',
  'awards_text',
  'self_evaluation',
]

const LEVELS = ['high', 'medium', 'low']
const NEUTRAL_SCORE = 50
const NEUTRAL_CONFIDENCE = 0.3
const MAX_EVIDENCE = 3

function loadDimensions() {
  return JSON.parse(fs.readFileSync(DIM_FILE, 'utf8')).dimensions
}

/** 规范化：去掉空白、统一大小写与常见全角标点，仅用于"是不是子串"的判断 */
function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。、；：！？（）【】“”‘’]/g, (c) => ({ '，': ',', '。': '.', '、': ',', '；': ';', '：': ':', '！': '!', '？': '?', '（': '(', '）': ')', '【': '[', '】': ']', '“': '"', '”': '"', '‘': "'", '’': "'" })[c] || c)
}

/** 把输入对象拼成一段原文（与提示词里的 <原文> 一致） */
function buildCorpus(input = {}) {
  return INPUT_FIELDS.map((f) => String(input[f] ?? '')).join('\n')
}

/** score -> level，档位与 utils 里的 scoreToLevel 保持一致（≥80 / ≥60 / 其余） */
function scoreToLevel(score) {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}

function validateStudentAnalysis(payload, input = {}) {
  const dimensions = loadDimensions()
  const keys = dimensions.map((d) => d.key)
  const errors = []
  const warnings = []
  const corpus = normalizeForMatch(buildCorpus(input))

  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['输出不是对象'], warnings: [], normalized: null }
  }
  if (!Array.isArray(payload.dimensions)) {
    return { ok: false, errors: ['缺少 dimensions 数组'], warnings: [], normalized: null }
  }

  const byKey = new Map()
  payload.dimensions.forEach((d, i) => {
    if (!d || typeof d !== 'object') {
      errors.push(`第 ${i + 1} 项不是对象`)
      return
    }
    if (!keys.includes(d.key)) {
      errors.push(`出现未知维度 key：${String(d.key)}`)
      return
    }
    if (byKey.has(d.key)) errors.push(`维度重复：${d.key}`)
    byKey.set(d.key, d)
  })

  const missing = []
  const out = []
  let droppedEvidence = 0

  for (const meta of dimensions) {
    const raw = byKey.get(meta.key)
    if (!raw) {
      missing.push(meta.key)
      out.push({
        key: meta.key,
        score: NEUTRAL_SCORE,
        level: scoreToLevel(NEUTRAL_SCORE),
        confidence: NEUTRAL_CONFIDENCE,
        evidence: [],
      })
      continue
    }

    // ---- 数值范围 ----
    const score = Number(raw.score)
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      errors.push(`${meta.key}: score 必须是 0~100 整数，实际 ${JSON.stringify(raw.score)}`)
    }
    const confidence = Number(raw.confidence)
    if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
      errors.push(`${meta.key}: confidence 必须是 0~1，实际 ${JSON.stringify(raw.confidence)}`)
    }
    if (raw.level !== undefined && !LEVELS.includes(raw.level)) {
      errors.push(`${meta.key}: level 非法（${String(raw.level)}）`)
    }

    // ---- evidence：必须是原文子串 ----
    const evidenceRaw = Array.isArray(raw.evidence) ? raw.evidence : []
    if (!Array.isArray(raw.evidence)) errors.push(`${meta.key}: evidence 必须是数组`)

    const kept = []
    for (const e of evidenceRaw.slice(0, MAX_EVIDENCE)) {
      const text = String(e ?? '').trim()
      if (!text) continue
      if (text.length > 40) {
        warnings.push(`${meta.key}: evidence 超过 40 字，已截断`)
      }
      const clipped = text.slice(0, 40)
      if (corpus.includes(normalizeForMatch(clipped))) kept.push(clipped)
      else {
        droppedEvidence++
        warnings.push(`${meta.key}: evidence 不是原文子串，已丢弃 -> ${clipped}`)
      }
    }

    // 全部被判定为编造 -> 该维度的结论也应当降级
    let finalConfidence = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0
    if (evidenceRaw.length > 0 && kept.length === 0) {
      finalConfidence = Math.min(finalConfidence, NEUTRAL_CONFIDENCE)
      warnings.push(`${meta.key}: 依据全部不可追溯，confidence 已压到 ${NEUTRAL_CONFIDENCE}`)
    }

    const finalScore = Number.isInteger(score) && score >= 0 && score <= 100 ? score : NEUTRAL_SCORE
    const derived = scoreToLevel(finalScore)
    if (raw.level && LEVELS.includes(raw.level) && raw.level !== derived) {
      warnings.push(`${meta.key}: level(${raw.level}) 与 score(${finalScore}) 档位不一致，按 score 归一`)
    }

    out.push({
      key: meta.key,
      score: finalScore,
      level: derived,
      confidence: finalConfidence,
      evidence: kept,
    })
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized: {
      dimensions: out,
      summary: typeof payload.summary === 'string' ? payload.summary.slice(0, 200) : '',
      missing,
      droppedEvidence,
    },
  }
}

module.exports = {
  INPUT_FIELDS,
  MAX_EVIDENCE,
  NEUTRAL_SCORE,
  NEUTRAL_CONFIDENCE,
  buildCorpus,
  loadDimensions,
  normalizeForMatch,
  scoreToLevel,
  validateStudentAnalysis,
}
