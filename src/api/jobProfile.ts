/**
 * 岗位画像 API —— 千问结构化解析任务 + 本地规则降级兜底
 *
 * ## 接口契约（待后端实现）
 *
 * 沿用项目现有 AI 对话的「异步任务」模式（见 pages/ai/ai.vue），
 * 因为大模型解析单条岗位文本耗时较长，同步接口容易触发小程序 10s 超时。
 *
 * 1) 创建解析任务
 *    POST /api/v1/employment/job-profile/parse/task/
 *    Header: Authorization: JWT <accessToken>
 *    Body:   JobProfileParsePayload
 *    202 →  { "task_id": "xxx" }
 *
 * 2) 轮询任务结果
 *    GET  /api/v1/employment/job-profile/parse/result/?task_id=xxx
 *    200 →  { "status": "PENDING" | "SUCCESS" | "FAILURE",
 *             "data": { "profile": JobProfile },
 *             "error": "失败原因" }
 *
 * 3) 读取已缓存的画像（可选，后端按 recruitment_id 缓存解析结果，避免重复调用千问）
 *    GET  /api/v1/employment/job-profile/?recruitment_id=<credit_code>
 *    200 →  JobProfile
 *    404 →  尚未解析过
 *
 * ## 后端尚未就绪时的行为
 *
 * 三个接口任一环节失败（404 / 501 / 500 / 超时 / 返回结构不合法）时，
 * 自动降级到 `parseJobProfileByRules()` 本地规则解析，
 * 并在返回值里通过 `degraded: true` + `degradedReason` 如实告知页面，
 * 由页面标注「本地规则解析」，不伪装成千问结果。
 *
 * ## 为什么这里用原生 uni.request 而不是 @/utils/request
 *
 * `@/utils/request` 的响应拦截器会在 statusCode >= 400 时主动 showToast。
 * 而本模块在接口未就绪时需要「静默探测 + 静默降级」，
 * 若走拦截器会导致用户一进页面就看到报错弹窗。
 * 现有 recruitment 模块同样使用原生 uni.request，此处保持一致。
 */

import { baseURL } from '@/utils/request';
import {
  JOB_DIMENSION_KEYS,
  isValidJobProfile,
  normalizeJobProfile,
  type JobProfile,
  type JobProfileGenerateResult,
  type JobProfileParsePayload,
  type JobProfileTaskResult,
} from '@/types/jobProfile';
import { parseJobProfileByRules, type RuleParseInput } from '@/utils/jobProfileParser';

// ====================== 端点常量 ======================

export const JOB_PROFILE_ENDPOINTS = {
  /** 创建千问解析任务 */
  parseTask: '/api/v1/employment/job-profile/parse/task/',
  /** 轮询解析任务结果 */
  parseResult: '/api/v1/employment/job-profile/parse/result/',
  /** 读取已缓存画像 */
  detail: '/api/v1/employment/job-profile/',
} as const;

// ====================== 基础请求封装 ======================

interface RawResponse<T> {
  statusCode: number;
  data: T;
}

/** 统一的鉴权请求头 */
const authHeader = (): Record<string, string> => ({
  Authorization: `JWT ${uni.getStorageSync('accessToken') || ''}`,
  'Content-Type': 'application/json',
});

/**
 * 原生 uni.request 的 Promise 封装（不弹 toast，由调用方决定如何处理错误）
 */
const rawRequest = <T = unknown>(
  url: string,
  method: 'GET' | 'POST',
  data?: unknown,
  timeout = 8000
): Promise<RawResponse<T>> =>
  new Promise((resolve, reject) => {
    uni.request({
      url: `${baseURL}${url}`,
      method,
      data: data as Record<string, unknown>,
      header: authHeader(),
      timeout,
      success: (res) => {
        resolve({ statusCode: res.statusCode, data: res.data as T });
      },
      fail: (err) => {
        reject(new Error(err?.errMsg || '网络请求失败'));
      },
    });
  });

// ====================== 1. 创建千问解析任务 ======================

/**
 * 创建千问结构化解析任务
 * @returns task_id
 * @throws 接口未就绪 / 网络异常 / 结构不合法时抛错，由上层降级
 */
export const createJobProfileParseTask = async (
  payload: JobProfileParsePayload
): Promise<string> => {
  const res = await rawRequest<{ task_id?: string; detail?: string; error?: string }>(
    JOB_PROFILE_ENDPOINTS.parseTask,
    'POST',
    payload,
    8000
  );

  // 后端未实现时通常是 404；未开放时可能是 403/501
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      res.data?.detail || res.data?.error || `解析任务接口不可用（HTTP ${res.statusCode}）`
    );
  }

  const taskId = res.data?.task_id;
  if (!taskId) {
    throw new Error('解析任务接口未返回 task_id');
  }
  return taskId;
};

// ====================== 2. 查询任务结果 ======================

/** 查询一次任务结果 */
export const fetchJobProfileParseResult = async (taskId: string): Promise<JobProfileTaskResult> => {
  const res = await rawRequest<JobProfileTaskResult>(
    `${JOB_PROFILE_ENDPOINTS.parseResult}?task_id=${encodeURIComponent(taskId)}`,
    'GET',
    undefined,
    8000
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`查询解析结果失败（HTTP ${res.statusCode}）`);
  }

  const body = res.data;
  if (!body || typeof body.status !== 'string') {
    throw new Error('解析结果接口返回结构不合法');
  }
  return body;
};

// ====================== 3. 读取缓存画像 ======================

/** 读取后端已缓存的画像；未解析过返回 null */
export const fetchCachedJobProfile = async (recruitmentId: string): Promise<JobProfile | null> => {
  const res = await rawRequest<JobProfile | { profile?: JobProfile }>(
    `${JOB_PROFILE_ENDPOINTS.detail}?recruitment_id=${encodeURIComponent(recruitmentId)}`,
    'GET',
    undefined,
    6000
  );

  if (res.statusCode === 404) return null;
  if (res.statusCode < 200 || res.statusCode >= 300) return null;

  const raw =
    (res.data as { profile?: JobProfile })?.profile ?? (res.data as JobProfile | undefined);
  if (!raw || !isValidJobProfile(raw)) return null;
  return normalizeJobProfile(raw);
};

// ====================== 4. 轮询任务直到完成 ======================

interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (message: string) => void;
  /** 返回 true 时立即停止轮询（页面已卸载等），并以 AbortError 拒绝 */
  shouldStop?: () => boolean;
}

/** 构造可识别的取消错误：上层据此跳过「降级本地规则」等后续动作 */
const createAbortError = (): Error => {
  const err = new Error('岗位画像解析已取消');
  err.name = 'AbortError';
  return err;
};

/**
 * 轮询任务结果，直到 SUCCESS / FAILURE / 超时 / 被取消
 * @throws 超时、FAILURE 或被取消时抛错（取消时为 AbortError），由上层处理
 */
export const pollJobProfileTask = (
  taskId: string,
  options: PollOptions = {}
): Promise<JobProfile> => {
  const { intervalMs = 1000, timeoutMs = 30000, onProgress, shouldStop } = options;

  return new Promise<JobProfile>((resolve, reject) => {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const tick = async () => {
      // 取消保护：页面已卸载时不再继续发请求
      // （否则用户退出页面后仍会持续轮询最多 timeoutMs，白白消耗请求额度）
      if (shouldStop?.()) {
        cleanup();
        reject(createAbortError());
        return;
      }

      // 超时保护
      if (Date.now() - startedAt > timeoutMs) {
        cleanup();
        reject(new Error('千问解析超时，已切换本地规则解析'));
        return;
      }

      try {
        const result = await fetchJobProfileParseResult(taskId);

        if (result.status === 'SUCCESS') {
          const profile = result.data?.profile;
          if (!profile || !isValidJobProfile(profile)) {
            cleanup();
            reject(new Error('千问返回的画像结构不完整'));
            return;
          }
          cleanup();
          resolve(normalizeJobProfile(profile));
          return;
        }

        if (result.status === 'FAILURE') {
          cleanup();
          reject(new Error(result.error || '千问解析失败'));
          return;
        }

        // PENDING：继续轮询
        const seconds = Math.round((Date.now() - startedAt) / 1000);
        onProgress?.(`千问正在解析岗位文本…（已等待 ${seconds}s）`);
        timer = setTimeout(tick, intervalMs);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('轮询解析结果失败'));
      }
    };

    // 首次稍作延迟，避免刚创建就查询
    timer = setTimeout(tick, intervalMs);
  });
};

// ====================== 5. 组装解析载荷 ======================

/** 把招聘原始数据组装成千问解析任务的请求载荷 */
export const buildParsePayload = (input: RuleParseInput): JobProfileParsePayload => ({
  recruitment_id: input.recruitment_id ?? '',
  job_name: input.job_name ?? '',
  enterprise_name: input.enterprise_name ?? '',
  industry: input.industry ?? '',
  recruit_major: input.recruit_major ?? '',
  monthly_salary: input.monthly_salary ?? '',
  recruit_number: input.recruit_number ?? '',
  enterprise_intro: input.enterprise_intro ?? '',
  dimensions: [...JOB_DIMENSION_KEYS],
});

// ====================== 6. 对外主入口 ======================

export interface GenerateOptions {
  /** 是否先尝试读取后端缓存（默认 true） */
  useCache?: boolean;
  /** 是否跳过千问、直接用本地规则（默认 false，调试用） */
  forceLocal?: boolean;
  /** 轮询间隔 */
  intervalMs?: number;
  /** 轮询超时 */
  timeoutMs?: number;
  /** 进度回调，用于页面展示「解析中」文案 */
  onProgress?: (message: string) => void;
  /** 返回 true 时中止轮询（页面已卸载），以 AbortError 抛出 */
  shouldStop?: () => boolean;
}

/**
 * 生成岗位画像（对外唯一入口）
 *
 * 流程：
 *   1. （可选）读取后端缓存画像 → 命中直接返回
 *   2. 创建千问解析任务 → 轮询结果 → 校验结构
 *   3. 任一步骤失败 → 降级本地规则解析，并返回 degraded=true + degradedReason
 *
 * 无论走哪条路径，返回值都保证是「十维齐全、权重合计为 1」的合法画像，
 * 页面无需做额外兜底判断。
 */
export const generateJobProfile = async (
  input: RuleParseInput,
  options: GenerateOptions = {}
): Promise<JobProfileGenerateResult> => {
  const {
    useCache = true,
    forceLocal = false,
    intervalMs,
    timeoutMs,
    onProgress,
    shouldStop,
  } = options;

  // ---- 1. 缓存命中 ----
  if (useCache && !forceLocal && input.recruitment_id) {
    try {
      onProgress?.('正在读取已有岗位画像…');
      const cached = await fetchCachedJobProfile(input.recruitment_id);
      if (cached) {
        return { profile: cached, method: cached.parse_method, degraded: false };
      }
    } catch {
      // 缓存读取失败不影响主流程，静默忽略
    }
  }

  // ---- 2. 千问解析 ----
  if (!forceLocal) {
    try {
      onProgress?.('正在提交千问解析任务…');
      const taskId = await createJobProfileParseTask(buildParsePayload(input));
      const profile = await pollJobProfileTask(taskId, {
        intervalMs,
        timeoutMs,
        onProgress,
        shouldStop,
      });
      return { profile, method: 'qwen', degraded: false };
    } catch (err) {
      // 取消不是「失败」：页面已卸载，不应再降级解析、更不该回写状态
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      const reason = err instanceof Error ? err.message : '千问解析不可用';
      console.warn('[岗位画像] 千问解析不可用，降级为本地规则解析：', reason);
      onProgress?.('千问接口暂不可用，正在使用本地规则解析…');
      const profile = parseJobProfileByRules(input);
      return { profile, method: 'rule', degraded: true, degradedReason: reason };
    }
  }

  // ---- 3. 强制本地 ----
  onProgress?.('正在使用本地规则解析…');
  const profile = parseJobProfileByRules(input);
  return { profile, method: 'rule', degraded: false };
};

// ====================== 7. 招聘原始记录读取 ======================

/** 招聘原始记录（与 recruitment-detail / recruitment-list 的字段保持一致） */
export interface RecruitmentRecord {
  id: string | number;
  enterprise_name: string;
  credit_code: string;
  enterprise_nature: string;
  enterprise_scale: string;
  enterprise_intro: string;
  industry: string;
  job_name: string;
  recruit_major: string;
  recruit_number: string;
  monthly_salary: string;
  contact_person: string;
  contact_phone: string;
  company_address: string;
  booth_number: string;
  check_in_status: string;
  is_alumni_enterprise: string;
  email: string;
}

interface RecruitmentListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RecruitmentRecord[];
}

/**
 * 按信用代码读取招聘原始记录。
 *
 * 说明：后端目前没有「按信用代码取单条」的接口，
 * 只能沿用现有列表接口的 `?search=` 做模糊查询再取第一条
 * （招聘详情页、岗位画像页也是这么做的）。
 * 这里把它抽成公共函数，避免在三个页面里各写一份。
 *
 * TODO 后端补一个 `/api/v1/employment/recruitments/{credit_code}/` 之后改用它，
 *      当前实现存在「search 命中多条时可能取错」的风险。
 */
export const fetchRecruitmentByCreditCode = (
  creditCode: string
): Promise<RecruitmentRecord> =>
  new Promise((resolve, reject) => {
    uni.request({
      url: `${baseURL}/api/v1/employment/recruitments/?search=${encodeURIComponent(creditCode)}`,
      method: 'GET',
      header: {
        Authorization: `JWT ${uni.getStorageSync('accessToken') || ''}`,
      },
      success: (res) => {
        const body = res.data as RecruitmentListResponse;
        if (res.statusCode === 401) {
          reject(new Error('登录已过期，请重新登录后再试'));
          return;
        }
        if (res.statusCode === 200 && body?.results?.length) {
          resolve(body.results[0]);
        } else {
          reject(new Error('未找到该招聘信息'));
        }
      },
      fail: (err) => reject(new Error(err?.errMsg || '网络异常，请稍后重试')),
    });
  });
