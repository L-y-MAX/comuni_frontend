// src/types/knowledge/node.ts
export interface KnowledgeNode {
  id: string;
  name: string;
  content: string;
  description: string;
  knowledge_base_id: string;
  created_at: string;
  updated_at: string;
  creator: string;
  creator_user_id: string;
  creator_username: string;
  knowledge_base_name: string;
  tags?: NodeTag[];
  category?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  attachments?: NodeAttachment[];
}

export interface NodeAttachment {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface NodeTag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface NodeHistory {
  id: string;
  node_id: string;
  content: string;
  description: string;
  changed_at: string;
  changed_by: string;
  changed_by_username: string;
  change_type: 'create' | 'update' | 'delete';
  version?: number;
}

export interface KnowledgeNodeCreateRequest {
  name: string;
  content: string;
  description: string;
  knowledge_base_id: string;
  tags?: string[];
  category?: string;
}

export interface KnowledgeNodeUpdateRequest extends Partial<KnowledgeNodeCreateRequest> {
  id: string;
}
