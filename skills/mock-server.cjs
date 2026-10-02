/**
 * 本地 mock 中转服务（P0：无需任何 API Key，就能把全链路跑通）。
 *
 *   POST /v1/tasks          提交任务      -> { task_id, status: 'pending', poll_after_ms }
 *   GET  /v1/tasks/{id}     轮询结果      -> { status: 'done', parse_method, profile, ... }
 *   GET  /v1/skills         列出 skill 与提示词
 *
 * 诚实性约束：
 *   - 返回里固定带 `mock: true` 与 `skill_version: "1.0.0-mock"`，绝不冒充真实模型结果
 *   - 结果先过一遍 contract.cjs 校验再返回，所以 mock 本身就在证明契约是自洽的
 *
 * 用法：node skills/mock-server.cjs [port]
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const { validateStudentAnalysis, loadDimensions, NEUTRAL_SCORE, NEUTRAL_CONFIDENCE } = require('./student-profile-analyze/contract.cjs')

const PORT = Number(process.argv[2] || process.env.PORT || 3100)
const SKILL_VERSION = '1.0.0-mock'
const SKILL_ID = 'student-profile-analyze'

/** 任务表 + 一个朴素的延迟：模拟"模型要跑一两秒" */
const tasks = new Map()
const LATENCY_MS = 1200

/** 稳定的伪随机：同样的输入永远给同样的分，便于复现问题 */
function hash32(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

/** 从原文里取一小段做 evidence —— 保证是真实子串，不是编的 */
function snippetFrom(corpus, seed) {
  const parts = String(corpus || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6 && !/^(专业|年级|目标岗位|目标行业)：$/.test(s))
  if (!parts.length) return ''
  const pick = parts[Math.floor(seed * parts.length) % parts.length]
  return pick.slice(0, 40)
}

function mockAnalyze(input) {
  const dims = loadDimensions()
  const corpus = Object.values(input || {})
    .map((v) => String(v ?? ''))
    .filter(Boolean)
    .join('\n')
  const hasContent = corpus.replace(/\s/g, '').length >= 10

  const dimensions = dims.map((d) => {
    if (!hasContent) {
      // 空输入：如实给中性分 + 低置信度（这正是提示词要求的行为）
      return {
        key: d.key,
        score: NEUTRAL_SCORE,
        level: 'low',
        confidence: NEUTRAL_CONFIDENCE,
        evidence: [],
      }
    }
    const r = hash32(d.key + corpus)
    const score = Math.round(52 + r * 42) // 52~94，视觉上像真实结果
    const confidence = Number((0.45 + r * 0.4).toFixed(2))
    const ev = snippetFrom(corpus, hash32(d.key))
    return {
      key: d.key,
      score,
      level: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
      confidence,
      evidence: ev ? [ev] : [],
    }
  })

  return {
    dimensions,
    summary: hasContent
      ? '（mock 数据）按输入原文逐维给出中性到偏高的评估，仅用于打通链路，不代表真实模型结论。'
      : '（mock 数据）未读到有效内容，各维度均为中性基准分。',
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1024 * 512) reject(new Error('请求体过大'))
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
  })
}

function send(res, code, obj) {
  const body = JSON.stringify(obj, null, 2)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const p = url.pathname

  try {
    if (req.method === 'GET' && p === '/v1/skills') {
      const promptFile = path.join(__dirname, SKILL_ID, 'prompt.md')
      return send(res, 200, {
        skills: [
          {
            id: SKILL_ID,
            version: SKILL_VERSION,
            input_fields: require('./student-profile-analyze/contract.cjs').INPUT_FIELDS,
            prompt: fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8') : null,
          },
        ],
        mock: true,
      })
    }

    if (req.method === 'POST' && p === '/v1/tasks') {
      const body = await readBody(req)
      if (body.skill && body.skill !== SKILL_ID) {
        return send(res, 400, { error: `未知 skill：${body.skill}` })
      }
      const taskId = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      tasks.set(taskId, { createdAt: Date.now(), input: body.input || {}, result: null, checked: null })
      return send(res, 202, {
        task_id: taskId,
        status: 'pending',
        poll_after_ms: 500,
        mock: true,
        skill_version: SKILL_VERSION,
      })
    }

    const m = /^\/v1\/tasks\/([\w-]+)$/.exec(p)
    if (req.method === 'GET' && m) {
      const task = tasks.get(m[1])
      if (!task) return send(res, 404, { error: 'task 不存在' })

      if (Date.now() - task.createdAt < LATENCY_MS) {
        return send(res, 200, { task_id: m[1], status: 'pending', poll_after_ms: 500, mock: true })
      }

      if (!task.result) {
        const profile = mockAnalyze(task.input)
        const check = validateStudentAnalysis(profile, task.input)
        task.result = profile
        task.checked = check
        if (check.warnings.length) {
          console.log(`[mock] 任务 ${m[1]} 校验告警 ${check.warnings.length} 条：`)
          check.warnings.slice(0, 5).forEach((w) => console.log('   - ' + w))
        }
      }

      return send(res, 200, {
        task_id: m[1],
        status: 'done',
        // 真实后端这里才是 'llm'；mock 一律带 mock: true 便于前端辨认
        parse_method: 'llm',
        mock: true,
        skill_version: SKILL_VERSION,
        model: 'mock/local',
        degraded: false,
        profile: task.result,
        validation: {
          ok: task.checked.ok,
          errors: task.checked.errors,
          warnings: task.checked.warnings,
        },
      })
    }

    send(res, 404, { error: 'not found', path: p })
  } catch (e) {
    send(res, 400, { error: e instanceof Error ? e.message : String(e) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`▶ mock 中转已启动：http://127.0.0.1:${PORT}`)
  console.log('   POST /v1/tasks           提交任务')
  console.log('   GET  /v1/tasks/{task_id} 轮询结果')
  console.log('   GET  /v1/skills          查询 skill 与提示词')
  console.log('   返回固定带 mock:true，不要当成真实模型结果使用')
})
