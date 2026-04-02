// 统一导入请求函数（确保路径别名@配置正确）
import { request } from '@/utils/request'

/**
 * 评论类型枚举（小写 root/answer 匹配后端参数）
 * 枚举是“值”，可正常导出和使用
 */
export enum CommentType {
  ROOT = 'root',
  ANSWER = 'answer'
}

/**
 * 评论用户信息类型
 * 类型别名（仅编译时存在，不能当值用）
 */
export type CommentUser = {
  id: string
  username: string
  avatar?: string // 补充常见字段，增强兼容性
  gender?: number // 可选：0-未知 1-男 2-女
}

/**
 * 评论项类型（仅用type定义，避免重复）
 * 兼容递归引用 + 命名导出，确保构建工具识别
 */
export type CommentItem = {
  id: string
  article_id: string
  article_name: string
  comment_text: string
  comment_date: string // 建议格式：YYYY-MM-DD HH:mm:ss
  type: CommentType
  user_info: CommentUser | null // 评论发布者
  root_id?: string // 仅answer类型：关联的根评论ID
  to_user_id?: string // 仅answer类型：回复的目标用户ID
  to_user?: CommentUser | null // 仅answer类型：回复的目标用户信息
  answers?: CommentItem[] // 递归：根评论下的回复列表
  answer_count?: number // 根评论的回复总数
}

/**
 * 获取文章评论列表
 * @param params - { article_id: 文章ID, type: 评论类型 }
 * @returns Promise<CommentItem[]> - 评论列表
 */
export const getNodeComments = (params: {
  article_id: string
  type: CommentType
}) => {
  return request<CommentItem[]>({ // 显式指定返回类型
    url: `/api/v1/knowledge/knowledgenode/${params.article_id}/comments/`,
    method: 'GET',
    params: { type: params.type },
    showLoading: true,
    loadingText: '加载评论中...'
  })
}

/**
 * 获取指定根评论下的回复列表（适配后端offset/limit分页）
 * @param params - { article_id: 文章ID, root_id: 根评论ID, offset: 偏移量, limit: 每页数量 }
 * @returns Promise<{ results: CommentItem[], count: number }> - 分页回复数据
 */
export const getNodeAnswerComments = (params: {
  article_id: string
  root_id: string
  limit: number
}) => {
  return request<{ results: CommentItem[], count: number }>({
    url: `/api/v1/knowledge/knowledgenode/${params.article_id}/comments/`,
    method: 'GET',
    params: {
      type: CommentType.ANSWER,
      root_id: params.root_id,
      limit: params.limit
    },
    showLoading: false,
    loadingText: '加载回复中...'
  })
}

/**
 * 获取文章根评论列表（适配后端offset/limit分页）
 * @param params - { article_id: 文章ID, offset: 偏移量, limit: 每页数量 }
 * @returns Promise<{ results: CommentItem[], count: number }> - 分页根评论数据
 */
export const getNodeRootComments = (params: {
  article_id: string
  offset: number,
  limit: number
}) => {
  return request<{ results: CommentItem[], count: number }>({
    url: `/api/v1/knowledge/knowledgenode/${params.article_id}/comments/`,
    method: 'GET',
    params: {
      type: CommentType.ROOT,
      offset: params.offset,
      limit: params.limit
    },
    showLoading: true,
    loadingText: '加载评论中...'
  })
}

/**
 * 新增评论/回复
 * @param data - 评论提交数据
 * @returns Promise<CommentItem> - 新增的评论数据
 */
export const addNodeComment = (data: {
  article_id: string
  comment_text: string
  type: CommentType
  root_id?: string // 回复评论时必传
  to_user_id?: string // 回复评论时必传
}) => {
  return request<CommentItem>({
    url: `/api/v1/knowledge/knowledgenode/${data.article_id}/comments/`,
    method: 'POST',
    data,
    showLoading: true,
    loadingText: '提交评论中...'
  })
}

/**
 * 删除评论
 * @param articleId - 文章节点ID
 * @param commentId - 评论ID
 * @returns Promise<{ success: boolean }> - 删除结果
 */
export const deleteNodeComment = (articleId: string, commentId: string) => {
  // 校验参数类型和有效性
  if (typeof articleId !== 'string' || typeof commentId !== 'string') {
    return Promise.reject(new Error('文章ID/评论ID必须是字符串'))
  }
  if (!articleId.trim() || !commentId.trim()) {
    return Promise.reject(new Error('文章ID/评论ID不能为空'))
  }

  return request<{ success: boolean }>({
    url: `/api/v1/knowledge/knowledgenode/${articleId}/comments/${commentId}/`,
    method: 'DELETE',
    showLoading: true,
    loadingText: '删除评论中...'
  })
}

// 仅导出“值”（枚举、函数），去掉类型别名（类型只能命名导入）
export default {
  CommentType, // 枚举是值，可导出
  getNodeComments, // 函数是值，可导出
  getNodeRootComments, // 新增：导出根评论分页函数
  getNodeAnswerComments, // 新增：导出回复分页函数
  addNodeComment,
  deleteNodeComment
}
