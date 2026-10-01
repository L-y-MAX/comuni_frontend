/**
 * 就业政策与校招资源（Career Resource）数据模型
 *
 * 定位：一个**离线可用的结构化资源库**，把公开的就业政策、校招渠道与求职指导
 * 整理成同一种结构，供小程序内浏览、检索与复制官方链接。
 *
 * 三条红线（决定了字段设计）：
 * 1. **不转载原文**。学校与人社部门的正式文件有版权，本模块只做「来源 + 定位 + 官方链接」，
 *    因此每条资源都带 `url`，界面提供「复制官方链接」而不是内嵌全文。
 * 2. **不编造条款**。没有核对过的补贴金额、申领条件、截止时间一律不写进 `summary`；
 *    需要用户自己去原文确认的，就在 `advice` 里明确说「去原文看哪一节」。
 * 3. **来源可追溯**。`kind` 区分「官方文件 / 官方平台 / 媒体报道 / 平台原创整理」，
 *    界面上如实标注，原创内容不会被包装成官方口径。
 */

// ====================== 主题 ======================

export type ResourceTheme = 'policy' | 'campus' | 'guide';

export interface ResourceThemeMeta {
  key: ResourceTheme;
  label: string;
  /** 主题一句话说明 */
  desc: string;
  icon: string;
}

/** 三个主题（顺序即界面上的顺序） */
export const RESOURCE_THEMES: ResourceThemeMeta[] = [
  {
    key: 'policy',
    label: '就业政策',
    desc: '国家、山东省与聊城市的毕业生就业创业政策文件',
    icon: '📄',
  },
  {
    key: 'campus',
    label: '校招企业名单',
    desc: '校招渠道、双选会与已核实的来校招聘企业',
    icon: '🏢',
  },
  {
    key: 'guide',
    label: '简历与面试指导',
    desc: '平台整理的求职实务方法，可与能力画像联动使用',
    icon: '📝',
  },
];

// ====================== 来源类型 ======================

/**
 * 来源类型。
 * 界面会把它渲染成角标，避免把平台原创内容误认成官方文件。
 */
export type ResourceKind = 'gov-doc' | 'official-platform' | 'media' | 'own';

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  'gov-doc': '官方文件',
  'official-platform': '官方平台',
  media: '媒体报道',
  own: '平台整理',
};

// ====================== 标签 ======================

/**
 * 资源标签。
 * 用于跨主题检索（例如点「补贴」能同时看到政策文件与相关指导）。
 */
export type ResourceTag =
  | '补贴'
  | '见习'
  | '基层'
  | '创业'
  | '社保'
  | '招聘渠道'
  | '双选会'
  | '宣讲会'
  | '在招企业'
  | '简历'
  | '面试'
  | '投递'
  | '政策原文';

// ====================== 资源条目 ======================

export interface CareerResource {
  id: string;
  theme: ResourceTheme;
  /** 条目标题（文件名或主题名） */
  title: string;
  /** 发布机构 / 来源 */
  source: string;
  /** 文号，有则显示 */
  docNo?: string;
  /** 发布日期（YYYY-MM-DD）。未核实到确切日期时**省略该字段**，界面不显示 —— 不猜 */
  date?: string;
  tags: ResourceTag[];
  /**
   * 这条资源是什么、该怎么用。
   * 只写能站得住的内容：文件性质、发布主体、与你求职的关系；
   * 不写未经核对的条款数字。
   */
  summary: string;
  /** 使用建议：具体去原文看哪一部分 */
  advice?: string;
  /** 官方链接 */
  url?: string;
  kind: ResourceKind;
}

// ====================== 政策类型速查 ======================

/**
 * 毕业生常见政策类型速查的条目结构。
 *
 * 注意：具体条目数据放在 @/utils/careerResources.ts（属于内容而非类型），
 * 这里只定义结构。
 */
export interface PolicyCategory {
  name: string;
  /** 面向哪些人 */
  audience: string;
  /** 一句话说明 */
  desc: string;
  /** 关联标签，点击可筛出本页相关政策文件 */
  tag: ResourceTag;
}
