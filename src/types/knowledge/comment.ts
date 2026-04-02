// src/types/knowledge/comment.ts
export interface Comment {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  knowledge_base: string;
  node: string;
  commentator: string;
  commentator_username: string;
  parent_comment?: string;
  replies?: Comment[];
  like_count?: number;
  is_liked?: boolean;
}

export interface CommentCreateRequest {
  content: string;
  knowledge_base: string;
  node: string;
  parent_comment?: string;
}

export interface CommentUpdateRequest {
  id: string;
  content: string;
}
