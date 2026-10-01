/**
 * 学生能力画像 API —— 千问结构化解析任务 + 本地规则降级兜底
 *
 * ## 接口契约（待后端实现）
 *
 * 与岗位画像（api/jobProfile.ts）采用完全相同的异步任务模式，
 * 复用后端已有的 Celery + DashScope(qwen-turbo) 基础设施（见 ai_chat/tasks.py）。
 *
 * 1) 创建解析任务
 *    POST /api/v1/auth/user/student-profile/parse/task/
 *    Body: StudentProfileParsePayload
 *    202 → { "task_id": "xxx" }
 *
 * 2) 轮询任务结果
 *    GET  /api/v1/auth/user/student-profile/parse/result/?task_id=xxx
 *    200 → { "status": "PENDING"|"SUCCESS"|"FAILURE", "data": { "profile": StudentProfile }, "error": "..." }
 *
 * 3) 读取已保存的画像（学生画像与用户绑定，一人一份）
 *    GET  /api/v1/auth/user/student-profile/
 *    200 → StudentProfile ／ 404 → 尚未生成过
 *
 * ## 后端未就绪时
 *
 * 任一环节失败（404/401/500/超时/结构不合法）都会降级到
 * `parseStudentProfileByRules()` 本地规则解析，并返回 degraded=true + 原因。
 *
 * ## 一个有用的副作用
 *
 * 学生画像的输入来自**用户自己填的表单**，不需要先拉取任何远程数据，
 * 因此即使完全没有登录、后端接口全 404，本页依然能产出并展示完整画像。
 * 这让「看界面 / 答辩演示」不依赖登录状态。
 */

import { baseURL } from '@/utils/request';
import { JOB_DIMENSION_KEYS } from '@/types/jobProfile';
import {
  isValidStudentProfile,
  normalizeStudentProfile,
  type StudentProfile,
  type StudentProfileInput,
} from '@/types/studentProfile';
import { parseStudentProfileByRules } from '@/utils/studentProfileParser';

// ====================== 端点常量 ======================

export const STUDENT_PROFILE_ENDPOINTS = {
  parseTask: '/api/v1/auth/user/student-profile/parse/task/',
  parseResult: '/api/v1/auth/user/student-profile/parse/result/',
  detail: '/api/v1/auth/user/student-profile/',
} as const;

/** 请求载荷（把学生填写内容整体交给后端做千问抽取） */
export interface StudentProfileParsePayload extends StudentProfileInput {
  dimensions: string[];
}

// ====================== 基础请求封装 ======================

interface RawResponse<T> {
  statusCode: number;
  data: T;
}

const authHeader = (): Record<string, string> => ({
  Authorization: `JWT ${uni.getStorageSync('accessToken') || ''}`,
  'Content-Type': 'application/json',
});

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
      success: (res) => resolve({ statusCode: res.statusCode, data: res.data as T }),
      fail: (err) => reject(new Error(err?.errMsg || '网络请求失败')),
    });
  });

// ====================== 取消 ======================

const createAbortError = (): Error => {
  const err = new Error('学生画像解析已取消');
  err.name = 'AbortError';
  return err;
};

// ====================== 1. 创建解析任务 ======================

export const createStudentProfileParseTask = async (
  payload: StudentProfileParsePayload
): Promise<string> => {
  const res = await rawRequest<{ task_id?: string; detail?: string; error?: string }>(
    STUDENT_PROFILE_ENDPOINTS.parseTask,
    'POST',
    payload,
    8000
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      res.data?.detail || res.data?.error || `解析任务接口不可用（HTTP ${res.statusCode}）`
    );
  }
  const taskId = res.data?.task_id;
  if (!taskId) throw new Error('解析任务接口未返回 task_id');
  return taskId;
};

// ====================== 2. 查询任务结果 ======================

export interface StudentProfileTaskResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILURE';
  data?: { profile?: StudentProfile };
  error?: string;
}

export const fetchStudentProfileParseResult = async (
  taskId: string
): Promise<StudentProfileTaskResult> => {
  const res = await rawRequest<StudentProfileTaskResult>(
    `${STUDENT_PROFILE_ENDPOINTS.parseResult}?task_id=${encodeURIComponent(taskId)}`,
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

// ====================== 3. 读取已保存画像 ======================

export const fetchSavedStudentProfile = async (): Promise<StudentProfile | null> => {
  const res = await rawRequest<StudentProfile | { profile?: StudentProfile }>(
    STUDENT_PROFILE_ENDPOINTS.detail,
    'GET',
    undefined,
    6000
  );

  if (res.statusCode === 404) return null;
  if (res.statusCode < 200 || res.statusCode >= 300) return null;

  const raw =
    (res.data as { profile?: StudentProfile })?.profile ?? (res.data as StudentProfile | undefined);
  if (!raw || !isValidStudentProfile(raw)) return null;
  return normalizeStudentProfile(raw);
};

// ====================== 4. 轮询 ======================

interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (message: string) => void;
  shouldStop?: () => boolean;
}

export const pollStudentProfileTask = (
  taskId: string,
  options: PollOptions = {}
): Promise<StudentProfile> => {
  const { intervalMs = 1000, timeoutMs = 30000, onProgress, shouldStop } = options;

  return new Promise<StudentProfile>((resolve, reject) => {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const tick = async () => {
      if (shouldStop?.()) {
        cleanup();
        reject(createAbortError());
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        cleanup();
        reject(new Error('千问解析超时，已切换本地规则解析'));
        return;
      }

      try {
        const result = await fetchStudentProfileParseResult(taskId);

        if (result.status === 'SUCCESS') {
          const profile = result.data?.profile;
          if (!profile || !isValidStudentProfile(profile)) {
            cleanup();
            reject(new Error('千问返回的画像结构不完整'));
            return;
          }
          cleanup();
          resolve(normalizeStudentProfile(profile));
          return;
        }

        if (result.status === 'FAILURE') {
          cleanup();
          reject(new Error(result.error || '千问解析失败'));
          return;
        }

        const seconds = Math.round((Date.now() - startedAt) / 1000);
        onProgress?.(`千问正在解析你的经历…（已等待 ${seconds}s）`);
        timer = setTimeout(tick, intervalMs);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('轮询解析结果失败'));
      }
    };

    timer = setTimeout(tick, intervalMs);
  });
};

// ====================== 5. 对外主入口 ======================

export interface GenerateStudentProfileOptions {
  useCache?: boolean;
  forceLocal?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (message: string) => void;
  shouldStop?: () => boolean;
}

export interface StudentProfileGenerateResult {
  profile: StudentProfile;
  method: 'qwen' | 'rule';
  degraded: boolean;
  degradedReason?: string;
}

/**
 * 生成学生能力画像（对外唯一入口）
 *
 * 流程：读已保存画像 → 建千问任务 → 轮询 → 校验；任一步失败降级本地规则。
 * 无论走哪条路径，返回值都保证是「十维齐全 + 完整度/竞争力/徽章齐备」的合法画像。
 */
export const generateStudentProfile = async (
  input: StudentProfileInput,
  options: GenerateStudentProfileOptions = {}
): Promise<StudentProfileGenerateResult> => {
  const { useCache = true, forceLocal = false, intervalMs, timeoutMs, onProgress, shouldStop } =
    options;

  // ---- 1. 已保存画像 ----
  if (useCache && !forceLocal) {
    try {
      onProgress?.('正在读取已保存的能力画像…');
      const saved = await fetchSavedStudentProfile();
      if (saved) {
        return { profile: saved, method: saved.parse_method, degraded: false };
      }
    } catch {
      // 读取失败不影响主流程
    }
  }

  // ---- 2. 千问解析 ----
  if (!forceLocal) {
    try {
      onProgress?.('正在提交千问解析任务…');
      const payload: StudentProfileParsePayload = {
        ...input,
        dimensions: [...JOB_DIMENSION_KEYS],
      };
      const taskId = await createStudentProfileParseTask(payload);
      const profile = await pollStudentProfileTask(taskId, {
        intervalMs,
        timeoutMs,
        onProgress,
        shouldStop,
      });
      return { profile, method: 'qwen', degraded: false };
    } catch (err) {
      // 取消不是失败：页面已卸载，不应再降级解析
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      const reason = err instanceof Error ? err.message : '千问解析不可用';
      console.warn('[学生画像] 千问解析不可用，降级为本地规则解析：', reason);
      onProgress?.('千问接口暂不可用，正在使用本地规则解析…');
      const profile = parseStudentProfileByRules(input);
      return { profile, method: 'rule', degraded: true, degradedReason: reason };
    }
  }

  // ---- 3. 强制本地 ----
  onProgress?.('正在使用本地规则解析…');
  return { profile: parseStudentProfileByRules(input), method: 'rule', degraded: false };
};
