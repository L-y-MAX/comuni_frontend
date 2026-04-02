# 类型定义结构说明

本项目采用结构化的类型定义管理，将所有TypeScript类型按照功能模块进行组织。

## 目录结构

```txt
src/types/
├── index.ts              # 主入口文件，导出所有类型
├── user/                 # 用户相关类型
│   ├── index.ts         # 用户类型导出
│   ├── user.ts          # 用户基础信息、登录注册等类型
│   └── vip.ts           # VIP会员相关类型
├── theme/                # 主题相关类型
│   └── index.ts         # 主题类型定义
├── knowledge/            # 知识库相关类型
│   ├── index.ts         # 知识库类型导出
│   ├── base.ts          # 知识库基础类型
│   ├── node.ts          # 知识节点类型
│   └── comment.ts       # 评论类型
└── api/                  # API响应相关类型
    ├── index.ts         # API类型导出
    └── response.ts      # 通用响应类型和分页类型
```

## 使用方法

### 导入类型

```typescript
// 导入所有类型
import type { UserInfo, VipInfo, ThemeMode } from '@/types';

// 导入特定模块类型
import type { KnowledgeBase, KnowledgeNode } from '@/types/knowledge';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
```

### 在组件中使用

```vue
<script setup lang="ts">
import type { UserInfo, ThemeMode } from '@/types';

interface Props {
  user: UserInfo;
  theme: ThemeMode;
}
</script>
```

### 在Store中使用

```typescript
import { defineStore } from 'pinia';
import type { UserInfo, VipInfo } from '@/types/user';

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null);
  const vipInfo = ref<VipInfo | null>(null);

  // ...
});
```

## 类型规范

### 命名约定

- 接口名使用 PascalCase，如 `UserInfo`, `KnowledgeBase`
- 类型别名使用 PascalCase，如 `ThemeMode`
- 属性名使用 camelCase，如 `userName`, `createdAt`
- 枚举值使用全大写或 PascalCase，如 `'admin' | 'write' | 'read'`

### 通用模式

- 所有实体类型都有 `id: string` 字段
- 时间字段使用 `created_at` 和 `updated_at`
- 分页响应使用统一的 `PaginatedResponse<T>` 类型
- API请求和响应类型分离，如 `CreateRequest` 和实体类型

### 可选字段

- 可选字段使用 `?:` 标记
- 对于可能为 null 的字段，使用 `| null`
- 对于数组字段，使用 `[]` 或 `Array<T>`

## 扩展类型

当需要扩展现有类型时：

```typescript
// 扩展用户信息
export interface UserProfile extends UserInfo {
  phone?: string;
  gender?: 'male' | 'female' | 'other';
}

// 使用工具类型
export type PartialUserInfo = Partial<UserInfo>;
export type RequiredUserId = RequiredFields<UserInfo, 'id'>;
```

## 注意事项

1. 所有类型定义应放在对应的模块目录下
2. 新增类型时记得在对应模块的 `index.ts` 中导出
3. 主 `index.ts` 文件会自动导出所有子模块的类型
4. 类型定义应与后端API保持同步
5. 使用 TypeScript 的严格模式，确保类型安全
