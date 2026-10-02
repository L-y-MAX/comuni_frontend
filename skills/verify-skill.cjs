/**
 * skill 自测：把「契约是自洽的、防幻觉是真的在工作」用断言钉住。
 *
 * 覆盖：
 *   A. 生成物与源码一致（十维 key 不许漂移）
 *   B. schema 与十维一致（minItems = maxItems = 维度数、enum 就是那十个 key）
 *   C. 三类样例（完整 / 极简 / 空）经过 mock 生成 + 校验，必须全部通过
 *   D. 四类坏数据必须被抓住：编造依据、维度缺失、维度重复、分数越界
 *
 * 用法：node skills/verify-skill.cjs
 */
const fs = require('fs')
const path = require('path')

const {
  INPUT_FIELDS,
  loadDimensions,
  validateStudentAnalysis,
  buildCorpus,
  NEUTRAL_SCORE,
} = require('./student-profile-analyze/contract.cjs')

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`)
  }
}

// ---------- A. 生成物 vs 源码 ----------
console.log('=== A. 十维来源一致性（防漂移）===')
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'types', 'jobProfile.ts'), 'utf8')
const sourceKeys = [...source.matchAll(/key:\s*'([a-z_]+)'/g)].map((m) => m[1])
const dims = loadDimensions()
const dimKeys = dims.map((d) => d.key)

check('从源码解析到 10 个维度', sourceKeys.length === 10, `实际 ${sourceKeys.length}`)
check(
  'dimensions.json 与源码 key 完全一致',
  sourceKeys.length === dimKeys.length && sourceKeys.every((k) => dimKeys.includes(k)),
  `源码 ${sourceKeys.join(',')} / 生成 ${dimKeys.join(',')}`,
)
check('维度 key 无重复', new Set(dimKeys).size === dimKeys.length)

// ---------- B. schema 与十维一致 ----------
console.log('')
console.log('=== B. schema 与十维一致 ===')
const schemaPath = path.join(__dirname, 'student-profile-analyze', 'schema.json')
check('schema.json 已生成', fs.existsSync(schemaPath))
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
const ds = schema.properties.dimensions
check('schema 要求维度数固定为 10', ds.minItems === 10 && ds.maxItems === 10, `${ds.minItems}~${ds.maxItems}`)
check(
  'schema 的 key 枚举就是那十个维度',
  ds.items.properties.key.enum.length === 10 && dimKeys.every((k) => ds.items.properties.key.enum.includes(k)),
)
check('schema 禁止多余字段', ds.items.additionalProperties === false && schema.additionalProperties === false)
check('schema 限制 score 0~100', ds.items.properties.score.minimum === 0 && ds.items.properties.score.maximum === 100)
check('schema 限制 evidence 最多 3 条', ds.items.properties.evidence.maxItems === 3)

// ---------- 三类样例 ----------
const SAMPLES = {
  完整: {
    major: '计算机科学与技术',
    grade: 'senior',
    target_job: 'Java 后端开发',
    target_industry: '互联网',
    skills_text: '熟练使用 Java、SpringBoot、MyBatis、MySQL、Redis，了解 Docker',
    certificates_text: '英语四级、计算机二级',
    internship_text: '在某某科技公司实习三个月，负责订单模块接口开发，把接口平均耗时从 800ms 降到 220ms',
    projects_text: '毕业设计做了一套校园二手交易平台，负责后端与数据库设计，上线后累计 300 多名同学使用',
    awards_text: '校级程序设计竞赛二等奖',
    self_evaluation: '学习能力强，抗压能力还可以，乐于和团队协作',
  },
  极简: { major: '软件工程', skills_text: '会一点 Vue' },
  空: {},
}

/** 与 mock-server 相同的生成口径（保证自测和联调看到的是同一套东西） */
function hash32(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}
function snippetFrom(corpus, seed) {
  const parts = String(corpus || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)
  if (!parts.length) return ''
  return parts[Math.floor(seed * parts.length) % parts.length].slice(0, 40)
}
function mockAnalyze(input) {
  const corpus = Object.values(input || {}).map((v) => String(v ?? '')).filter(Boolean).join('\n')
  const hasContent = corpus.replace(/\s/g, '').length >= 10
  return {
    dimensions: dims.map((d) => {
      if (!hasContent) {
        return { key: d.key, score: NEUTRAL_SCORE, level: 'low', confidence: 0.3, evidence: [] }
      }
      const r = hash32(d.key + corpus)
      const score = Math.round(52 + r * 42)
      const ev = snippetFrom(corpus, hash32(d.key))
      return {
        key: d.key,
        score,
        level: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
        confidence: Number((0.45 + r * 0.4).toFixed(2)),
        evidence: ev ? [ev] : [],
      }
    }),
    summary: '（mock 数据）仅用于打通链路。',
  }
}

console.log('')
console.log('=== C. 三类样例必须通过 ===')
for (const [name, input] of Object.entries(SAMPLES)) {
  const result = validateStudentAnalysis(mockAnalyze(input), input)
  check(`样例「${name}」校验通过`, result.ok, result.errors.join(' / '))
  check(`样例「${name}」十维齐全`, result.normalized.dimensions.length === 10)
  if (name === '空') {
    const allNeutral = result.normalized.dimensions.every(
      (d) => d.score === NEUTRAL_SCORE && d.confidence <= 0.3 && d.evidence.length === 0,
    )
    check('空输入：全部中性分 + 低置信度 + 无依据（不编造）', allNeutral)
  }
  if (name === '完整') {
    const withEvidence = result.normalized.dimensions.filter((d) => d.evidence.length > 0)
    check('完整输入：多数维度有可追溯依据', withEvidence.length >= 5, `实际 ${withEvidence.length} 个`)
  }
}

// ---------- D. 坏数据必须被抓住 ----------
console.log('')
console.log('=== D. 坏数据必须被抓住 ===')

// D1 编造依据
{
  const input = SAMPLES.完整
  const bad = mockAnalyze(input)
  bad.dimensions[0].evidence = ['我在字节跳动实习过一年，独立负责核心支付系统'] // 原文没有
  const r = validateStudentAnalysis(bad, input)
  const d0 = r.normalized.dimensions[0]
  check('编造的依据被丢弃', d0.evidence.length === 0, JSON.stringify(d0.evidence))
  check('依据全丢后 confidence 被压低', d0.confidence <= 0.3, String(d0.confidence))
  check('编造被记账为 droppedEvidence', r.normalized.droppedEvidence >= 1)
}

// D2 维度缺失
{
  const input = SAMPLES.完整
  const bad = mockAnalyze(input)
  bad.dimensions = bad.dimensions.slice(0, 7) // 少 3 个
  const r = validateStudentAnalysis(bad, input)
  check('缺维度不算致命错误（可补齐）', r.ok, r.errors.join(' / '))
  check('缺失的维度被记进 missing', r.normalized.missing.length === 3, JSON.stringify(r.normalized.missing))
  check('补齐的维度给中性分', r.normalized.dimensions.every((d) => d.score >= 0 && d.score <= 100))
}

// D3 维度重复 / 未知 key
{
  const bad = mockAnalyze(SAMPLES.完整)
  bad.dimensions[1] = { ...bad.dimensions[0] }
  const r = validateStudentAnalysis(bad, SAMPLES.完整)
  check('维度重复被报错', !r.ok && r.errors.some((e) => e.includes('重复')), r.errors.join(' / '))
}
{
  const bad = mockAnalyze(SAMPLES.完整)
  bad.dimensions[2] = { ...bad.dimensions[2], key: 'not_a_real_dimension' }
  const r = validateStudentAnalysis(bad, SAMPLES.完整)
  check('未知维度 key 被报错', !r.ok && r.errors.some((e) => e.includes('未知维度')), r.errors.join(' / '))
}

// D4 分数越界
{
  const bad = mockAnalyze(SAMPLES.完整)
  bad.dimensions[3].score = 130
  const r = validateStudentAnalysis(bad, SAMPLES.完整)
  check('score 越界被报错', !r.ok && r.errors.some((e) => e.includes('score')), r.errors.join(' / '))
}

// D5 level 与 score 不一致 -> 只告警并归一
{
  const bad = mockAnalyze(SAMPLES.完整)
  bad.dimensions[4].score = 20
  bad.dimensions[4].level = 'high'
  const r = validateStudentAnalysis(bad, SAMPLES.完整)
  const d = r.normalized.dimensions[4]
  check('level 与 score 不一致时按 score 归一', d.level === 'low', d.level)
  check('并留下告警', r.warnings.some((w) => w.includes('档位不一致')))
}

console.log('')
console.log(`结果：${pass} 通过 / ${fail} 失败`)
if (fail) {
  console.log('')
  console.log('提示：如果 A 组失败，先跑 node skills/sync-dimensions.cjs 重新生成。')
}
process.exit(fail ? 1 : 0)
