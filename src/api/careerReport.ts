/**
 * 职业生涯发展报告 —— 导出与持久化
 *
 * ## 接口契约（待后端实现）
 *
 * 1) 导出为 PDF / Word
 *    POST /api/v1/auth/user/career-report/export/
 *    Body: { report_id, format: 'pdf' | 'docx', markdown, title }
 *    200 → { file_url: "https://.../report-xxx.pdf", expires_at: "..." }
 *    然后前端 downloadFile → openDocument
 *
 * 2) 保存报告（可选，便于教师端查看与跨设备同步）
 *    POST /api/v1/auth/user/career-report/    Body: CareerReport
 *    GET  /api/v1/auth/user/career-report/    200 → CareerReport
 *
 * ## 为什么导出必须走后端
 *
 * 微信小程序的 `uni.openDocument` 只支持 doc/docx/xls/xlsx/ppt/pptx/pdf，
 * **不支持 txt**；而前端从零生成合法的 .docx（OOXML zip）或 PDF 成本很高、
 * 在真机上的兼容性也没有保证。因此正规做法是后端用 python-docx / reportlab
 * 生成文件后返回下载链接。
 *
 * 后端未就绪时**不静默失败**：返回 ok=false + 原因，并把 Markdown 全文回传给页面，
 * 引导用户用「复制全文」完成作业提交与存档，功能不中断。
 */

import { baseURL } from '@/utils/request';
import type { CareerReport } from '@/types/careerReport';

// ====================== 端点 ======================

export const CAREER_REPORT_ENDPOINTS = {
  export: '/api/v1/auth/user/career-report/export/',
  detail: '/api/v1/auth/user/career-report/',
} as const;

/** 支持的导出格式 */
export type ExportFormat = 'pdf' | 'docx';

export interface ExportResult {
  /** 是否成功导出为文件 */
  ok: boolean;
  /** 成功时的本地临时文件路径 */
  filePath?: string;
  /** 失败原因（含"后端接口未就绪"） */
  reason?: string;
  /** 降级时回传的 Markdown 全文，供页面引导用户复制 */
  fallbackMarkdown?: string;
}

// ====================== 请求封装 ======================

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
  timeout = 15000
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

// ====================== 导出 ======================

/**
 * 导出报告为 PDF / Word。
 *
 * 全流程：请求后端生成文件 → 下载 → 用系统组件打开。
 * 任一环节失败都会返回结构化的失败结果，不抛异常（导出是"锦上添花"的动作，
 * 不该把页面搞崩）。
 */
export const exportCareerReport = async (
  report: CareerReport,
  format: ExportFormat
): Promise<ExportResult> => {
  const fallbackMarkdown = report.markdown;

  // ---- 1. 请求后端生成文件 ----
  let fileUrl = '';
  try {
    const res = await rawRequest<{ file_url?: string; detail?: string; error?: string }>(
      CAREER_REPORT_ENDPOINTS.export,
      'POST',
      {
        report_id: report.id,
        format,
        title: `职业生涯发展报告-${report.student.major || '学生'}`,
        markdown: report.markdown,
      }
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      return {
        ok: false,
        reason:
          res.data?.detail ||
          res.data?.error ||
          `导出接口不可用（HTTP ${res.statusCode}）`,
        fallbackMarkdown,
      };
    }
    if (!res.data?.file_url) {
      return { ok: false, reason: '导出接口未返回文件地址', fallbackMarkdown };
    }
    fileUrl = res.data.file_url;
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : '导出请求失败',
      fallbackMarkdown,
    };
  }

  // ---- 2. 下载文件 ----
  const filePath = await new Promise<string>((resolve, reject) => {
    uni.downloadFile({
      url: fileUrl,
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) resolve(res.tempFilePath);
        else reject(new Error(`下载失败（HTTP ${res.statusCode}）`));
      },
      fail: (err) => reject(new Error(err?.errMsg || '下载失败')),
    });
  }).catch((err: Error) => {
    return `__ERROR__${err.message}`;
  });

  if (filePath.startsWith('__ERROR__')) {
    return { ok: false, reason: filePath.replace('__ERROR__', ''), fallbackMarkdown };
  }

  // ---- 3. 用系统组件打开 ----
  const opened = await new Promise<boolean>((resolve) => {
    uni.openDocument({
      filePath,
      fileType: format,
      showMenu: true,
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });

  if (!opened) {
    // 文件已下载成功，只是打不开：仍然算导出成功，把路径给出去
    return { ok: true, filePath, fallbackMarkdown };
  }

  return { ok: true, filePath };
};

// ====================== 保存 / 读取（可选） ======================

/** 把报告同步到后端（失败静默，本地缓存才是主存储） */
export const saveReportToServer = async (report: CareerReport): Promise<boolean> => {
  try {
    const res = await rawRequest(CAREER_REPORT_ENDPOINTS.detail, 'POST', report, 8000);
    return res.statusCode >= 200 && res.statusCode < 300;
  } catch {
    return false;
  }
};

/** 从后端读取报告（未登录或接口未就绪时返回 null） */
export const fetchReportFromServer = async (): Promise<CareerReport | null> => {
  try {
    const res = await rawRequest<CareerReport | { report?: CareerReport }>(
      CAREER_REPORT_ENDPOINTS.detail,
      'GET',
      undefined,
      8000
    );
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    const raw = (res.data as { report?: CareerReport })?.report ?? (res.data as CareerReport);
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as CareerReport).tasks)) return null;
    return raw as CareerReport;
  } catch {
    return null;
  }
};
