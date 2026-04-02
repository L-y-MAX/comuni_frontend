// src/types/index.ts
// 用户相关类型
export * from './user';

// 主题相关类型
export * from './theme';

// 知识库相关类型
export * from './knowledge';

// API响应相关类型
export * from './api';

// 通用工具类型
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 状态管理类型
export interface StoreState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface AsyncActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// 表单验证类型
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface FormField {
  value: any;
  error: string;
  touched: boolean;
  rules?: ValidationRule[];
}

export interface FormState {
  [key: string]: FormField;
}
