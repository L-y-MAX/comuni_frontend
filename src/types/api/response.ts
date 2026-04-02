// src/types/api/response.ts
// 通用分页响应类型
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// 通用API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
}

// 错误响应类型
export interface ApiError {
  code: number;
  message: string;
  details?: any;
}

// 文件上传响应类型
export interface FileUploadResponse {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploaded_at: string;
}

// 搜索请求类型
export interface SearchRequest {
  query: string;
  page?: number;
  page_size?: number;
  filters?: Record<string, any>;
  sort?: string;
  order?: 'asc' | 'desc';
}

// 搜索响应类型
export interface SearchResponse<T> extends PaginatedResponse<T> {
  query: string;
  total_results: number;
  search_time: number;
  suggestions?: string[];
}

// 统计数据类型
export interface StatisticsData {
  total_count: number;
  active_count: number;
  inactive_count: number;
  growth_rate?: number;
  period?: string;
}

// 通知类型
export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  user_id?: string;
}

// 导出所有分页响应类型
export type KnowledgeBaseListResponse = PaginatedResponse<import('../knowledge/base').KnowledgeBase>;
export type KnowledgeNodeListResponse = PaginatedResponse<import('../knowledge/node').KnowledgeNode>;
export type KnowledgeShareListResponse = PaginatedResponse<import('../knowledge/base').KnowledgeShare>;
export type CommentListResponse = PaginatedResponse<import('../knowledge/comment').Comment>;
export type NodeTagListResponse = PaginatedResponse<import('../knowledge/node').NodeTag>;
export type NodeHistoryListResponse = PaginatedResponse<import('../knowledge/node').NodeHistory>;
