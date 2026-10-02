import { request, get, post } from '@/utils/request';
import type {
  KnowledgeBase,
  KnowledgeBaseListResponse,
  KnowledgeShareListResponse,
  KnowledgeNode,
  KnowledgeNodeListResponse,
} from '@/types/knowledge';

const API_PREFIX = '/api/v1/knowledge';

// ====================== 工具函数 ======================
/**
 * 获取当前登录用户的ID（creator字段，匹配后端返回的creator格式：71979518-2aa2-458d-be8b-bb67709876b7）
 */
const getCurrentUserCreatorId = (): string => {
  try {
    const userInfoRaw = uni.getStorageSync('userInfo');

    // 核心修复：兼容 userInfo 是对象 / JSON字符串 两种情况
    let userInfo: any;
    if (typeof userInfoRaw === 'string') {
      // 是字符串则解析为对象（空字符串/无效JSON直接抛错）
      if (!userInfoRaw.trim()) throw new Error('userInfo为空字符串');
      userInfo = JSON.parse(userInfoRaw);
    } else if (typeof userInfoRaw === 'object' && userInfoRaw !== null) {
      // 是对象则直接使用
      userInfo = userInfoRaw;
    } else {
      throw new Error('userInfo格式异常（非字符串/非对象）');
    }

    // 优先取用户ID（匹配后端返回的creator格式），其次取username
    const creatorId = userInfo.id || userInfo.user_id || userInfo.creator_id || userInfo.username;
    if (!creatorId) {
      throw new Error('用户信息中无有效ID字段');
    }

    return creatorId;
  } catch (error) {
    console.error(' 用户信息解析失败：', error);
    uni.showToast({ title: '用户信息缺失/解析失败，请重新登录', icon: 'error' });
    uni.redirectTo({ url: '/pagesMember/login/login' });
    throw new Error('用户信息解析失败');
  }
};

/**
 * 获取知识节点详情（替换原有路径，适配新接口）
 * @param id 知识节点ID
 */
export const getKnowledgeNodeDetail = (id: string) => {
  // 关键修改：路径从 /knowledgenode/${id}/ 改为 /nodes/${id}/
  return get<KnowledgeNode>(`${API_PREFIX}/nodes/${id}/`, undefined, {
    showLoading: true,
    loadingText: '获取知识节点详情中...'
  });
};

// ====================== 知识库（KnowledgeBase）相关 API ======================
/** 获取知识库列表（我的知识库） */
export const getKnowledgeBaseList = () => {
  return get<KnowledgeBaseListResponse>(`${API_PREFIX}/knowledgebase/my-knowledge-bases/`, undefined, {
    showLoading: false,
    loadingText: '获取知识库列表中...'
  });
};

/** 获取关注的知识库列表 */
export const getFollowKnowledgeBaseList = () => {
  // 匹配后端接口路径：/knowledgebase/followed-knowledge-bases/
  return get<KnowledgeBaseListResponse>(`${API_PREFIX}/knowledgebase/followed-knowledge-bases/`, undefined, {
    showLoading: false,
    loadingText: '获取关注的知识库列表中...'
  });
};

/** 关注知识库（RESTful规范：POST到用户关注资源） */
export const followKnowledgeBase = (knowledgeBaseId: string) => {
  if (!knowledgeBaseId) {
    uni.showToast({ title: '知识库ID不能为空', icon: 'error' });
    throw new Error('缺少知识库ID，无法关注');
  }
  // RESTful接口：POST /user-follow-knowledgebase/（资源路径，无动词）
  return post<unknown>(`${API_PREFIX}/user-follow-knowledgebase/`, {
    knowledge_base: knowledgeBaseId, // 后端字段名
    is_active: true // 激活关注状态
  }, {
    showLoading: true,
    loadingText: '关注知识库中...'
  });
};

/** 取消关注知识库（RESTful规范：PATCH修改is_active字段实现软删除） */
export const unfollowKnowledgeBase = async (knowledgeBaseId: string) => {
  if (!knowledgeBaseId) {
    uni.showToast({ title: '知识库ID不能为空', icon: 'error' });
    throw new Error('缺少知识库ID，无法取消关注');
  }

  // 1. 先查询当前用户对该知识库的关注记录ID
  const followRecords = await get<{
    count: number;
    results: Array<{ id: string; knowledge_base: string; is_active: boolean }>;
  }>(`${API_PREFIX}/user-follow-knowledgebase/`, {
    knowledge_base: knowledgeBaseId,
    is_active: true
  }, {
    showLoading: false
  });

  // 2. 无关注记录则直接返回成功
  if (followRecords.count === 0) {
    uni.showToast({ title: '未关注该知识库', icon: 'none' });
    return Promise.resolve();
  }

  // 3. PATCH修改is_active为false（软删除，符合后端RESTful规范）
  const followRecordId = followRecords.results[0].id;
  return request<unknown>({
    url: `${API_PREFIX}/user-follow-knowledgebase/${followRecordId}/`,
    method: 'PATCH' as any, // 仅修改此行：添加类型断言解决TS类型报错
    data: { is_active: false }, // 核心：软删除，设置为未激活
    showLoading: true,
    loadingText: '取消关注知识库中...'
  });
};

/** 获取分享给我的知识库列表 */
export const getSharedToMeKnowledgeBaseList = () => {
  // 基于已有的共享列表接口，筛选出分享给当前用户的知识库
  return get<KnowledgeShareListResponse>(`${API_PREFIX}/knowledgeshare/`, undefined, {
    showLoading: false,
    loadingText: '获取分享给我的知识库列表中...'
  }).then((shareRes) => {
    // 1. 获取当前用户ID
    const currentUserId = getCurrentUserCreatorId();
    // 2. 筛选出分享给当前用户的共享记录
    const myShareItems = shareRes.results.filter(item => item.shared_to === currentUserId);
    // 3. 提取对应的知识库ID列表
    const kbIds = myShareItems.map(item => item.knowledge_base);
    // 4. 批量获取这些知识库的详情（若后端支持批量查询，可优化为一次请求）
    if (kbIds.length === 0) {
      // 修复：补充分页相关字段 next/previous，匹配 KnowledgeBaseListResponse 类型
      return {
        count: 0,
        results: [],
        next: null,  // 分页下一页（无数据时为null）
        previous: null  // 分页上一页（无数据时为null）
      } as KnowledgeBaseListResponse;
    }

    // 方式1：逐个查询（兼容无批量接口的场景）
    return Promise.all(kbIds.map(kbId => get<KnowledgeBase>(`${API_PREFIX}/knowledgebase/${kbId}/`)))
      .then((kbList) => {
        // 修复：补充分页相关字段 next/previous
        return {
          count: kbList.length,
          results: kbList,
          next: null,
          previous: null
        } as KnowledgeBaseListResponse;
      });

    // 方式2：批量查询（若后端支持，替换上方代码）
    // const url = `${API_PREFIX}/knowledgebase/?ids=${kbIds.join(',')}`;
    // return get<KnowledgeBaseListResponse>(url);
  });
};

/** 新增知识库（必填creator：用户ID） */
export const addKnowledgeBase = (data: {
  name: string;
  description?: string;
  is_public?: boolean;
}) => {
  if (!data.name?.trim()) {
    uni.showToast({ title: '知识库名称不能为空', icon: 'error' });
    throw new Error('知识库名称不能为空');
  }

  const creatorId = getCurrentUserCreatorId();
  const submitData = {
    name: data.name.trim(),
    description: data.description?.trim() || '',
    is_public: data.is_public ?? false,
    creator: creatorId // 传递用户ID（必填）
  };

  return post<KnowledgeBase>(`${API_PREFIX}/knowledgebase/`, submitData, {
    showLoading: true,
    loadingText: '创建知识库中...'
  });
};

/** 删除知识库 */
export const deleteKnowledgeBase = (id: string) => {
  return request<unknown>({
    url: `${API_PREFIX}/knowledgebase/${id}/`,
    method: 'DELETE',
    showLoading: true,
    loadingText: '删除知识库中...'
  });
};

// ====================== 知识节点（KnowledgeNode）相关 API ======================
/**
 * 获取指定知识库下的知识节点列表（核心接口）
 * @param knowledgeBaseId 知识库ID（必填）
 */
export const getKnowledgeNodeListByKBId = async (knowledgeBaseId: string) => {
  if (!knowledgeBaseId) {
    uni.showToast({ title: '知识库ID不能为空', icon: 'error' });
    // 返回空列表而非抛出错误
    return {
      count: 0,
      results: [],
      next: null,
      previous: null
    } as KnowledgeNodeListResponse;
  }

  //使用新接口路径 /nodes/ + 查询参数 knowledge_base_id
  const url = `${API_PREFIX}/nodes/?knowledge_base_id=${knowledgeBaseId}`;

  try {
    return await get<KnowledgeNodeListResponse>(url, undefined, {
      showLoading: false,
      loadingText: '获取知识节点列表中...'
    });
  } catch (error: any) {
    // 捕获403无权限错误，返回空列表
    if (error?.statusCode === 403 || error?.message?.includes('403') || error?.message?.includes('无权限')) {
      console.warn('无访问该知识库的权限：', knowledgeBaseId);
      // 返回空的节点列表，不抛出错误
      return {
        count: 0,
        results: [],
        next: null,
        previous: null
      } as KnowledgeNodeListResponse;
    }
    // 其他错误正常提示，但仍返回空列表
    console.error('获取知识节点列表失败：', error);
    uni.showToast({ title: '获取数据失败，请重试', icon: 'none' });
    return {
      count: 0,
      results: [],
      next: null,
      previous: null
    } as KnowledgeNodeListResponse;
  }
};

/**
 * 保留原有接口（兼容旧调用），内部调用新接口
 * @param knowledgeBaseId 知识库ID（可选）
 */
export const getKnowledgeNodeList = (knowledgeBaseId?: string) => {
  // 兼容逻辑：有知识库ID则调用新接口，无则调用旧接口
  if (knowledgeBaseId) {
    return getKnowledgeNodeListByKBId(knowledgeBaseId);
  }
  // 无ID时调用原有接口（可根据需求调整，也可直接抛出错误）
  const url = `${API_PREFIX}/knowledgenode/`;
  return get<KnowledgeNodeListResponse>(url, undefined, {
    showLoading: false,
    loadingText: '获取知识节点列表中...'
  }).catch(error => {
    // 兼容旧接口的错误处理
    console.error('获取知识节点列表失败：', error);
    return {
      count: 0,
      results: [],
      next: null,
      previous: null
    } as KnowledgeNodeListResponse;
  });
};

/** 新增知识节点（必填creator + knowledge_base） */
export const addKnowledgeNode = (data: {
  name: string;
  content?: string;
  description?: string;
  knowledge_base_id: string; // 前端传入的知识库ID
}) => {
  if (!data.name?.trim()) {
    uni.showToast({ title: '知识节点名称不能为空', icon: 'error' });
    throw new Error('知识节点名称不能为空');
  }
  if (!data.knowledge_base_id) {
    uni.showToast({ title: '请选择所属知识库', icon: 'error' });
    throw new Error('缺少知识库ID');
  }

  const creatorId = getCurrentUserCreatorId();
  const submitData = {
    name: data.name.trim(),
    content: data.content?.trim() || '',
    description: data.description?.trim() || '',
    creator: creatorId, // 必填：用户ID
    knowledge_base: data.knowledge_base_id // 必填：映射为knowledge_base（后端字段）
  };

  // 关键修改：新增节点的路径改为 /nodes/（适配新接口）
  return post<KnowledgeNode>(`${API_PREFIX}/nodes/`, submitData, {
    showLoading: true,
    loadingText: '创建知识节点中...'
  });
};

/** 编辑知识节点（核心修复：补充creator + knowledge_base必填字段） */
export const updateKnowledgeNode = async (
  id: string,
  data: {
    name?: string;
    content?: string;
    description?: string;
    knowledge_base_id?: string; // 可选：若需要修改所属知识库
  }
) => {
  // 1. 获取原始节点信息（用于补全creator和knowledge_base）
  const originalNode = await getKnowledgeNodeDetail(id);
  if (!originalNode) {
    throw new Error('知识节点不存在');
  }

  // 2. 构造提交参数（补全所有必填字段）
  const submitData = {
    name: data.name?.trim() || originalNode.name, // 未传则用原值
    content: data.content?.trim() || originalNode.content,
    description: data.description?.trim() || originalNode.description,
    creator: originalNode.creator, // 必传：使用原始的creator（用户ID）
    knowledge_base: data.knowledge_base_id || originalNode.knowledge_base_id // 必传：知识库ID
  };

  // 关键修改：编辑节点的路径改为 /nodes/${id}/（适配新接口）
  return request<KnowledgeNode>({
    url: `${API_PREFIX}/nodes/${id}/`,
    method: 'PUT',
    data: submitData,
    showLoading: true,
    loadingText: '更新知识节点中...'
  });
};

/** 删除知识节点 */
export const deleteKnowledgeNode = (id: string) => {
  // 关键修改：删除节点的路径改为 /nodes/${id}/（适配新接口）
  return request<unknown>({
    url: `${API_PREFIX}/nodes/${id}/`,
    method: 'DELETE',
    showLoading: true,
    loadingText: '删除知识节点中...'
  });
};
