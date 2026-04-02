// src/types/knowledge/base.ts
export interface KnowledgeBase {
  id: string;
  short_id: string;
  name: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  creator: string;
  creator_username?: string;
  tags?: string[];
  category?: string;
  view_count?: number;
  like_count?: number;
}

export interface KnowledgeBaseCreateRequest {
  name: string;
  description: string;
  is_public: boolean;
  tags?: string[];
  category?: string;
}

export interface KnowledgeBaseUpdateRequest extends Partial<KnowledgeBaseCreateRequest> {
  id: string;
}

export interface KnowledgeShare {
  id: string;
  permission_level: 'admin' | 'write' | 'read';
  shared_at: string;
  updated_at: string;
  knowledge_base: string;
  shared_to: string;
  shared_to_username?: string;
}

export interface KnowledgeShareCreateRequest {
  knowledge_base_id: string;
  shared_to: string;
  permission_level: 'admin' | 'write' | 'read';
}
