/**
 * 功能导航（侧边栏用）—— 全站功能入口的单一数据源。
 *
 * 为什么单独抽一个文件：侧边栏要「把功能总结起来」，如果路由和文案写死在页面里，
 * 以后新增页面就得回到 abilityProfile.vue 里改模板，容易漏、也容易写错跳转方式。
 * 集中在这里之后，页面只负责渲染。
 *
 * 两条硬约束（都踩过坑）：
 * 1. **tabBar 页面只能用 switchTab**，用 navigateTo 会静默失败；
 *    非 tabBar 页面只能用 navigateTo。所以每项都显式标了 `type`。
 * 2. **需要参数的页面要能在缺参数时自洽**。岗位能力画像页（job-profile）的 onLoad
 *    原本必须拿到 `options.id`（招聘记录信用代码），缺参数就报「参数错误」。
 *    现在它缺参数时会进入「岗位选择」模式（真实校招岗位 + 内置示例岗位），
 *    因此可以直接挂入口。新增需要参数的页面时，请同样先保证缺参数不白屏。
 */

/** 打开方式：tabBar 页面 vs 普通页面 */
export type FeatureNavType = 'tab' | 'page';

export interface FeatureNavItem {
  /** 唯一标识，同时用于标记「当前所在功能」 */
  key: string;
  name: string;
  desc: string;
  icon: string;
  type: FeatureNavType;
  path: string;
  /** 需要登录才能使用（未登录时先引导登录） */
  needLogin?: boolean;
}

export interface FeatureNavGroup {
  title: string;
  items: FeatureNavItem[];
}

/** 当前所在功能（侧边栏据此高亮） */
export const CURRENT_FEATURE_KEY = 'abilityProfile';

export const FEATURE_NAV_GROUPS: FeatureNavGroup[] = [
  {
    title: '核心能力',
    items: [
      {
        key: 'abilityProfile',
        name: '学生就业能力画像',
        desc: '填写个人情况，生成十维能力画像（当前页面）',
        icon: '🧑‍🎓',
        type: 'tab',
        path: '/pages/abilityProfile/abilityProfile',
      },
      {
        key: 'jobProfile',
        name: '岗位能力画像',
        desc: '查看岗位在十个能力维度上的要求（进页后选岗位）',
        icon: '💼',
        type: 'page',
        path: '/pagesMember/recruitment/job-profile',
      },
      {
        key: 'jobMatch',
        name: '人岗智能匹配',
        desc: '我的画像 × 岗位要求，输出匹配度与具体缺口',
        icon: '🎯',
        type: 'page',
        path: '/pagesMember/jobMatch/jobMatch',
      },
      {
        key: 'careerReport',
        name: '个性化生涯发展报告',
        desc: '职业路径规划 + 分阶段成长计划',
        icon: '🧭',
        type: 'page',
        path: '/pagesMember/careerReport/careerReport',
      },
      {
        key: 'reportHistory',
        name: '历史报告记录',
        desc: '回看历次报告，并与最新一次对比',
        icon: '🕘',
        type: 'page',
        path: '/pagesMember/reportHistory/reportHistory',
      },
    ],
  },
  {
    title: '求职资源',
    items: [
      {
        key: 'careerResources',
        name: '就业政策与校招资源',
        desc: '政策文件、校招渠道、简历与面试指导',
        icon: '📚',
        type: 'page',
        path: '/pagesMember/careerResources/careerResources',
      },
      {
        key: 'recruitment',
        name: '就业招聘信息',
        desc: '浏览校招合作企业的岗位与企业信息',
        icon: '🏢',
        type: 'page',
        path: '/pagesMember/recruitment/recruitment-list',
      },
    ],
  },
  {
    title: '平台功能',
    items: [
      {
        key: 'index',
        name: '首页',
        desc: '搜索知识库、文档与用户',
        icon: '🔍',
        type: 'tab',
        path: '/pages/index/index',
      },
      {
        key: 'ai',
        name: 'AI 助手',
        desc: '围绕文章内容的智能问答',
        icon: '🤖',
        type: 'tab',
        path: '/pages/ai/ai',
      },
      {
        key: 'knowledge',
        name: '知识库',
        desc: '收藏与管理 Markdown 文档',
        icon: '📝',
        type: 'page',
        path: '/pages/knowledge/knowledge',
      },
      {
        key: 'my',
        name: '我的',
        desc: '个人中心、关注/粉丝、功能说明',
        icon: '👤',
        type: 'tab',
        path: '/pages/my/my',
      },
      {
        key: 'follow',
        name: '我的关注 / 粉丝',
        desc: '查看关注与粉丝列表（需要登录）',
        icon: '👥',
        type: 'page',
        path: '/pagesMember/follow/follow',
        needLogin: true,
      },
      {
        key: 'instruction',
        name: '功能说明',
        desc: '完整的使用说明书',
        icon: '📖',
        type: 'page',
        path: '/pagesMember/instruction/instruction',
      },
    ],
  },
];

/** 全部条目（扁平化，便于检索与统计） */
export const ALL_FEATURE_ITEMS: FeatureNavItem[] = FEATURE_NAV_GROUPS.flatMap((g) => g.items);

/**
 * 打开某个功能。
 *
 * @returns true = 已发起跳转；false = 被拦截（未登录），此时已弹出引导
 */
export const openFeatureNav = (item: FeatureNavItem): boolean => {
  if (item.needLogin && !uni.getStorageSync('accessToken')) {
    uni.showModal({
      title: '需要登录',
      content: `「${item.name}」需要登录后使用，是否现在去登录？`,
      confirmText: '去登录',
      cancelText: '再看看',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pagesMember/login/login' });
        }
      },
    });
    return false;
  }

  const onFail = (err: unknown) => {
    console.error(`跳转「${item.name}」失败：`, err);
    uni.showToast({ title: '页面跳转失败', icon: 'none', duration: 2000 });
  };

  // tabBar 页面与非 tabBar 页面的打开方式不同，用错会静默失败
  if (item.type === 'tab') {
    uni.switchTab({ url: item.path, fail: onFail });
  } else {
    uni.navigateTo({ url: item.path, fail: onFail });
  }
  return true;
};
