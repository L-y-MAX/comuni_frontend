/**
 * 从 src/types/jobProfile.ts 的 JOB_DIMENSIONS 生成：
 *   - skills/_shared/dimensions.json                    十维元数据
 *   - skills/student-profile-analyze/schema.json        学生画像输出的严格 schema
 *
 * 为什么要生成而不是手写：十维 key 一旦在两处维护，改了维度就会出现
 * 「提示词要 10 个、校验器只认 9 个」这类漂移，而且很难发现。
 * 这里以源码为唯一事实来源，解析不出来就报错退出（宁可失败，不要悄悄降级）。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SOURCE = path.join(ROOT, 'src', 'types', 'jobProfile.ts')
const OUT_SHARED = path.join(__dirname, '_shared', 'dimensions.json')
const OUT_SCHEMA = path.join(__dirname, 'student-profile-analyze', 'schema.json')

/** 解析 JOB_DIMENSIONS 数组里的每个条目 */
function parseDimensions(source) {
  const start = source.indexOf('export const JOB_DIMENSIONS')
  if (start === -1) throw new Error('找不到 JOB_DIMENSIONS，源码结构可能变了')

  // 注意：不能直接 indexOf('[')，因为类型标注 JobDimensionMeta[] 里已经有一个 []，
  // 从那里开始扫会立刻配对结束、解析出 0 个维度。必须从 '=' 之后开始找数组。
  const eq = source.indexOf('=', start)
  if (eq === -1) throw new Error('JOB_DIMENSIONS 缺少赋值号')
  const open = source.indexOf('[', eq)
  let depth = 0
  let end = -1
  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth++
    else if (source[i] === ']') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error('JOB_DIMENSIONS 数组未闭合')

  const body = source.slice(open + 1, end)
  const items = []
  const entryRe = /\{([\s\S]*?)\}/g
  let m
  while ((m = entryRe.exec(body))) {
    const text = m[1]
    const key = /key:\s*'([^']+)'/.exec(text)
    const label = /label:\s*'([^']+)'/.exec(text)
    const weight = /defaultWeight:\s*([\d.]+)/.exec(text)
    const description = /description:\s*'([^']*)'/.exec(text)
    if (!key || !label || !weight) {
      throw new Error(`有条目字段不全，无法解析：${text.slice(0, 60).replace(/\s+/g, ' ')}`)
    }
    items.push({
      key: key[1],
      label: label[1],
      weight: Number(weight[1]),
      description: description ? description[1] : '',
    })
  }
  return items
}

function buildSchema(dimensions) {
  const keys = dimensions.map((d) => d.key)
  const dimSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['key', 'score', 'level', 'confidence', 'evidence'],
    properties: {
      key: { type: 'string', enum: keys },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      level: { type: 'string', enum: ['high', 'medium', 'low'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      /** 必须是输入原文的子串 —— 服务端会逐条核对 */
      evidence: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 40 } },
    },
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'student-profile-analyze/output',
    type: 'object',
    additionalProperties: false,
    required: ['dimensions'],
    properties: {
      dimensions: {
        type: 'array',
        // 十维必须齐全且不许多余：minItems = maxItems = 维度数
        minItems: dimensions.length,
        maxItems: dimensions.length,
        items: dimSchema,
      },
      summary: { type: 'string', maxLength: 200 },
    },
  }
}

function main() {
  const source = fs.readFileSync(SOURCE, 'utf8')
  const dimensions = parseDimensions(source)

  if (dimensions.length !== 10) {
    throw new Error(`十维应为 10 项，实际解析到 ${dimensions.length} 项`)
  }
  const keys = dimensions.map((d) => d.key)
  if (new Set(keys).size !== keys.length) throw new Error('维度 key 有重复')

  const weightSum = dimensions.reduce((s, d) => s + d.weight, 0)
  if (Math.abs(weightSum - 1) > 0.001) {
    console.log(`⚠️  十维权重和为 ${weightSum.toFixed(3)}（不等于 1），请确认是否符合预期`)
  }

  fs.mkdirSync(path.dirname(OUT_SHARED), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_SCHEMA), { recursive: true })
  fs.writeFileSync(
    OUT_SHARED,
    JSON.stringify({ generatedFrom: 'src/types/jobProfile.ts', dimensions }, null, 2) + '\n',
    'utf8',
  )
  fs.writeFileSync(OUT_SCHEMA, JSON.stringify(buildSchema(dimensions), null, 2) + '\n', 'utf8')

  console.log(`✅ 已从 JOB_DIMENSIONS 生成 ${dimensions.length} 个维度`)
  dimensions.forEach((d, i) => console.log(`   ${String(i + 1).padStart(2)}. ${d.key.padEnd(22)} ${d.label}`))
  console.log(`   权重和 ${weightSum.toFixed(3)}`)
  console.log(`   -> skills/_shared/dimensions.json`)
  console.log(`   -> skills/student-profile-analyze/schema.json`)
}

main()
