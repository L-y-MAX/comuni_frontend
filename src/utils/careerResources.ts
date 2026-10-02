/**
 * 就业政策与校招资源 —— 结构化数据
 *
 * 数据来源与整理原则：
 *   - 每一条都对应**真实存在**的公开来源，`url` 为官方或权威发布地址，
 *     均已逐条核对可访问；
 *   - `summary` 只描述「这份文件/平台是什么、和你求职的关系」，
 *     **不含任何未经原文核对的补贴金额、申领条件与截止时间**；
 *   - 需要用户自行确认的部分，写进 `advice`，明确指向原文；
 *   - `date` 只在核实到确切日期时才写，未核实的直接省略（界面会隐藏该行），不猜年份。
 *
 * 为什么不把原文搬进来：校方与人社部门的正式文件属官方文书，
 * 参赛作品直接转载有版权与准确性问题，因此本模块只做「来源 + 定位 + 官方链接」。
 */

import type { CareerResource, PolicyCategory } from '@/types/careerResource';

// ====================== 政策类型速查 ======================

/**
 * 毕业生常见政策类型速查。
 *
 * 注意：这里是**方向性归类**，帮助同学知道「有这类政策、大致面向谁」，
 * 不是条款摘录，也不含任何金额与时限数字。具体标准一律以官方原文为准。
 */
export const POLICY_CATEGORIES: PolicyCategory[] = [
  {
    name: '一次性求职创业补贴',
    audience: '毕业年度内有求职创业意愿的困难毕业生',
    desc: '针对求职创业过程中的实际支出给予补贴；各地对「困难毕业生」身份的认定口径略有差异。',
    tag: '补贴',
  },
  {
    name: '就业见习补贴',
    audience: '离校未就业毕业生、见习单位',
    desc: '参加就业见习期间，由见习单位按规定申领补贴；是「先积累经历再就业」的一条路径。',
    tag: '见习',
  },
  {
    name: '社会保险补贴',
    audience: '招用毕业年度毕业生的小微企业、灵活就业毕业生',
    desc: '对符合条件的用人单位或个人缴纳的社会保险费给予补贴。',
    tag: '社保',
  },
  {
    name: '创业担保贷款及贴息',
    audience: '自主创业的高校毕业生',
    desc: '为创业初期提供担保贷款支持，符合条件可享受贴息。',
    tag: '创业',
  },
  {
    name: '基层就业学费补偿与贷款代偿',
    audience: '到基层单位就业的毕业生',
    desc: '对到规定地区基层单位就业的毕业生，补偿学费或代偿国家助学贷款。',
    tag: '基层',
  },
  {
    name: '“三支一扶”等基层项目',
    audience: '愿意到基层服务的毕业生',
    desc: '支教、支农、支医与帮扶乡村振兴等基层服务项目，服务期满后在考录等方面有相应政策衔接。',
    tag: '基层',
  },
  {
    name: '青年就业见习岗位募集',
    audience: '毕业生、用人单位',
    desc: '面向用人单位募集见习岗位，为毕业生提供过渡性的实践机会。',
    tag: '见习',
  },
  {
    name: '事业单位与国有企业招聘',
    audience: '应届及择业期内毕业生',
    desc: '面向高校毕业生的专项招聘，报考条件与时间以各级人社部门公告为准。',
    tag: '招聘渠道',
  },
];

// ====================== 联动说明 ======================

/**
 * 「与本小程序的联动」提示文案。
 * 这是把资源库接进求职闭环的说明——也是答辩时可以讲的一句话。
 */
export const RESOURCE_LINKAGE_NOTE =
  '在「人岗匹配」里算出的技能与证书缺口，可以直接变成简历里的待补关键词：先看匹配页列出「岗位要求但你尚未体现」的条目，再回到这一页对照政策找补贴与见习机会，最后按指导把经历写进简历。';

// ====================== 就业政策 ======================

const POLICY_RESOURCES: CareerResource[] = [
  {
    id: 'policy-sd-11-dept',
    theme: 'policy',
    title: '山东省促进高校毕业生等青年高质量充分就业若干措施',
    source: '山东省人力资源和社会保障厅等 11 部门',
    scope: '省级',
    tags: ['综合政策'],
    summary:
      '省级层面统筹高校毕业生等青年就业的综合性措施文件，是了解山东毕业生就业政策体系的主文件。本页不逐条摘录，避免转述失真。',
    advice:
      '先看文件的「适用范围」与「组织实施」两部分：前者决定你能不能享受，后者写明由哪个部门受理。',
    url: 'https://school.gxjy.sdei.edu.cn/wfus/school/Notice/detail/110',
    kind: 'gov-doc',
  },
  {
    id: 'policy-sd-2026-5',
    theme: 'policy',
    title: '山东省人力资源和社会保障厅就业创业政策文件（鲁人社发〔2026〕5 号）',
    source: '山东省人力资源和社会保障厅',
    docNo: '鲁人社发〔2026〕5 号',
    scope: '省级',
    tags: ['综合政策'],
    summary:
      '山东省人社厅发布的就业创业政策文件原文（PDF）。本页不转载、不摘录条款，只提供官方原文入口。',
    advice:
      '重点核对「适用对象」「补贴或扶持标准」「申报时限」三节——这三节决定你能不能报、能报多少、什么时候报。',
    url: 'http://hrss.shandong.gov.cn/resource/srst/att/202609/abf24080-5c87-4299-baf3-3fd70a9e4447.pdf',
    kind: 'gov-doc',
  },
  {
    id: 'policy-sd-2025-35',
    theme: 'policy',
    title: '山东省人力资源和社会保障厅就业工作文件（鲁人社字〔2025〕35 号）',
    source: '山东省人力资源和社会保障厅',
    docNo: '鲁人社字〔2025〕35 号',
    scope: '省级',
    tags: ['综合政策'],
    summary:
      '山东省人社厅发布的就业工作相关文件原文（DOCX）。本页不转载、不摘录条款，只提供官方原文入口。',
    advice: '下载后先看文末的「附件」，补贴类政策的具体项目清单与标准通常放在附件里。',
    url: 'http://hrss.shandong.gov.cn/resource/srst/att/202504/b13454c2-784c-4bdb-92c8-c5f1818c7808.docx',
    kind: 'gov-doc',
  },
  {
    id: 'policy-sd-quicklook',
    theme: 'policy',
    title: '山东省大学生就业优惠政策速查（2026 版）',
    source: '山东高校毕业生就业信息网',
    scope: '省级',
    tags: ['综合政策', '补贴'],
    summary:
      '把山东面向大学生的就业优惠政策按情形做了速查式归类，适合作为「先搞清有哪些政策」的第一站。',
    advice: '把它当目录用：先在速查表里定位你符合哪一类，再带着具体项目名称去搜文件原文。',
    url: 'https://school.gxjy.sdei.edu.cn/ytysgz/school/Notice/detail/201',
    kind: 'official-platform',
  },
  {
    id: 'policy-sd-12-dept-youth',
    theme: 'policy',
    title: '关于改革推进青年就业创业工作的通知',
    source: '中共山东省委宣传部、山东省人力资源和社会保障厅等 12 部门',
    scope: '省级',
    tags: ['创业'],
    summary:
      '多部门联合发文，方向是改革推进青年就业创业工作。涉及部门多，条款的受理主体也分散在各部门。',
    advice: '遇到「由某部门负责」的条款，直接按文件里写的部门去找对应办事窗口，不要只问学校就业中心。',
    url: 'https://fpkfb.shandong.gov.cn/articles/ch00354/202504/87ba10e8-0cf9-4098-8594-ef5d9cb5023c.shtml',
    kind: 'gov-doc',
  },
  {
    id: 'policy-sd-youth-leye',
    theme: 'policy',
    title: '“青年乐业山东”高质量就业创业工程实施方案（2026—2028 年）',
    source: '山东省人力资源和社会保障厅等 13 部门',
    scope: '省级',
    tags: ['综合政策', '见习'],
    summary:
      '省级三年期就业创业工程的实施方案，属于中期政策框架，会持续影响岗位供给与见习岗位募集的节奏。',
    advice: '看实施方案里的「年度目标」部分，能提前判断哪类岗位和项目在近两年会放量。',
    url: 'http://wenshang.gov.cn/art/2026/9/30/art_20050_2794513.html',
    kind: 'gov-doc',
  },
  {
    id: 'policy-lc-list',
    theme: 'policy',
    title: '聊城市就业创业扶持政策清单',
    source: '聊城日报（聊城市政策发布渠道）',
    scope: '市级',
    tags: ['补贴', '创业', '社保'],
    summary:
      '聊城市层面的就业创业扶持政策清单。校招岗位多来自本地企业，地方政策直接关系到你留在聊城就业能享受什么。',
    advice: '清单类文件适合逐条对照自身情况打勾，把「可能符合」的项目单独记下来再去核实。',
    url: 'http://lcrb.lcxw.cn/lcwb/pc/attachment/202608/28/9d5e0822-9cea-4c6d-963a-180db8cc6508.pdf',
    kind: 'gov-doc',
  },
  {
    id: 'policy-compilation-2024',
    theme: 'policy',
    title: '高校毕业生等青年就业创业政策汇编',
    source: '山东高校毕业生就业信息网',
    scope: '国家与省级',
    tags: ['综合政策', '见习'],
    summary:
      '把国家与省级的毕业生就业创业政策汇编成册，覆盖补贴、见习、基层项目、创业扶持等主要方向，适合系统通读。',
    advice: '通读一遍建立整体印象即可；真正要申领时，一定回到最新版文件核对标准是否已调整。',
    url: 'https://sdupsl.sdbys.com/news/view/aid/135849/tag/affair/binfo',
    kind: 'official-platform',
  },
];

// ====================== 校招企业名单 ======================

const CAMPUS_RESOURCES: CareerResource[] = [
  {
    id: 'campus-lcu-platform',
    theme: 'campus',
    title: '聊城大学大学生就业服务平台',
    source: '山东高校毕业生就业信息网 · 聊城大学',
    tags: ['招聘渠道'],
    summary:
      '学校官方的就业服务入口，集中发布校招岗位、宣讲会安排与就业通知。本小程序的招聘信息与岗位画像即以此为数据来源方向。',
    advice: '岗位信息以平台实时发布为准；本页只做入口指引，不缓存企业名单，避免你看到过期的岗位。',
    url: 'https://school.gxjy.sdei.edu.cn/lcu',
    kind: 'official-platform',
  },
  {
    id: 'campus-lcu-jobfair',
    theme: 'campus',
    title: '聊城大学就业管理系统 · 大型招聘会',
    source: '山东省高校毕业生就业管理系统',
    tags: ['双选会'],
    summary:
      '学校大型招聘会（双选会）的线上管理入口，可查看场次安排与参会单位情况。',
    advice: '双选会前先按「专业要求」筛出 5–8 家目标企业，现场直奔目标展位，效率远高于漫逛。',
    url: 'https://lcu.sdbys.com/largefairs/view/id/4218/type/1/tab/',
    kind: 'official-platform',
  },
  {
    id: 'campus-lcu-booth',
    theme: 'campus',
    title: '聊城大学就业双选会用人单位展位公布',
    source: '聊城大学就业服务平台公告',
    tags: ['双选会', '在招企业'],
    summary:
      '双选会的用人单位展位名单公告。展位表是判断「哪些企业真的来校招」最直接的依据。',
    advice: '拿到展位表后，把企业按行业分组，同行业的企业面谈话术可以复用，准备成本大幅下降。',
    url: 'https://school.gxjy.sdei.edu.cn/lcu/school/Notice/detail/200',
    kind: 'official-platform',
  },
  {
    id: 'campus-lcu-youran',
    theme: 'campus',
    title: '聊城优然牧业有限责任公司（平台在招企业）',
    source: '聊城大学大学生就业服务平台',
    tags: ['在招企业'],
    summary:
      '在聊城大学就业服务平台上发布招聘信息的企业之一，可作为「本地企业在校招什么岗位」的观察样本。',
    advice: '先在平台上看它当前在招的具体岗位，再回到本小程序用人岗匹配算一次适配度，判断值不值得投。',
    url: 'https://school.gxjy.sdei.edu.cn/lcu/front/JiuYeInfo?type=zwxx&companyName=%E8%81%8A%E5%9F%8E%E4%BC%98%E7%84%B6%E7%89%A7%E4%B8%9A%E6%9C%89%E9%99%90%E8%B4%A3%E4%BB%BB%E5%85%AC%E5%8F%B8',
    kind: 'official-platform',
  },
  {
    id: 'campus-lcu-pufa',
    theme: 'campus',
    title: '浦发银行聊城分行走进聊城大学开展招聘宣讲会',
    source: '聊城新闻网',
    tags: ['宣讲会'],
    summary:
      '金融机构进校宣讲的公开报道，可用于了解「哪些类型的企业会来聊城大学做宣讲」以及宣讲的常见组织形式。',
    advice: '宣讲会除了听岗位，更要留意「现场是否收简历」和「后续投递渠道」——很多企业宣讲会当场筛选。',
    url: 'https://www.lcxw.cn/zhuanti/jinrong/20260928/188442.html',
    kind: 'media',
  },
];

// ====================== 简历与面试指导（平台原创整理） ======================

const GUIDE_RESOURCES: CareerResource[] = [
  {
    id: 'guide-resume-one-page',
    theme: 'guide',
    title: '简历控制在一页：先做减法再做加法',
    source: '职途智行 · 平台整理',
    tags: ['简历'],
    summary:
      '应届生的简历主要靠「信息密度」取胜，不靠篇幅。一页的约束会强迫你只留下与目标岗位相关的经历，招聘方也能在十几秒内看完。',
    advice: '写完先删掉三类内容：与目标岗位无关的兼职、初高中经历、只有形容词没有事实的自我评价。',
    kind: 'own',
  },
  {
    id: 'guide-resume-keywords',
    theme: 'guide',
    title: '按岗位要求对齐关键词，而不是按你的经历顺序写',
    source: '职途智行 · 平台整理',
    tags: ['简历', '投递'],
    summary:
      '很多简历被筛掉不是能力不够，而是「岗位要的词」在简历里找不到。用人岗匹配页列出的岗位要求技能逐条对照，把已经具备但没写出来的补上。',
    advice:
      '打开「人岗匹配」，看「技能与证书缺口」那一栏：标为已具备的，确认简历里写清楚；标为未体现的，才是真正要补的。',
    kind: 'own',
  },
  {
    id: 'guide-resume-star',
    theme: 'guide',
    title: '用 STAR 把经历写成可验证的成果',
    source: '职途智行 · 平台整理',
    tags: ['简历'],
    summary:
      '把一段经历拆成情境、任务、行动、结果四段，其中「结果」尽量量化。量化过的描述比形容词可信得多，也更容易在面试中被追问时有话可说。',
    advice: '每个项目至少写出一个数字：处理了多少数据、覆盖多少用户、耗时降低了多少、带了几个人。',
    kind: 'own',
  },
  {
    id: 'guide-resume-skill-level',
    theme: 'guide',
    title: '技能别写「精通」：分级表述更经得起追问',
    source: '职途智行 · 平台整理',
    tags: ['简历', '面试'],
    summary:
      '把技能分成「熟练使用 / 了解 / 正在学习」三档，并给每档配一个证据。写「精通」但答不出底层原理，反而会拉低整份简历的可信度。',
    advice: '简历上的每一项技能，准备一句话说明「用它做过什么」。答不上来的项，降一档或删掉。',
    kind: 'own',
  },
  {
    id: 'guide-interview-intro',
    theme: 'guide',
    title: '自我介绍用 60 秒讲清三件事',
    source: '职途智行 · 平台整理',
    tags: ['面试'],
    summary:
      '结构固定为：我是谁（专业与年级）→ 我能做什么（与岗位最相关的两段经历）→ 我为什么来（对这家企业或岗位的具体了解）。不要复述简历全文。',
    advice: '对着手机录一遍掐时间，超过 90 秒就删内容。卡壳的地方就是面试官最可能追问的地方。',
    kind: 'own',
  },
  {
    id: 'guide-interview-gap',
    theme: 'guide',
    title: '被问到不会的问题：承认边界 + 给出思路',
    source: '职途智行 · 平台整理',
    tags: ['面试'],
    summary:
      '面试官问超出你知识范围的问题很常见，考察的往往不是答案本身，而是你面对未知时的处理方式。直接硬编比承认不会更扣分。',
    advice: '用「这部分我目前只了解到 X，我的思路是会先查 Y 再验证 Z」作答，把问题转成可执行的推理。',
    kind: 'own',
  },
  {
    id: 'guide-interview-cross',
    theme: 'guide',
    title: '跨专业求职：把可迁移能力讲成证据',
    source: '职途智行 · 平台整理',
    tags: ['面试', '投递'],
    summary:
      '专业不对口时，招聘方关心的是「你能不能补上」。用岗位图谱里的横移路径说明你已经研究过这条转型路线的成本与补课计划。',
    advice: '在「生涯发展报告」里看跨岗路径的平滑度标注：选平滑路径投，准备好「需要补什么、打算怎么补」。',
    kind: 'own',
  },
  {
    id: 'guide-apply-tiered',
    theme: 'guide',
    title: '分档投递：把匹配度当筛选器而不是结论',
    source: '职途智行 · 平台整理',
    tags: ['投递'],
    summary:
      '匹配度高不等于会录用，匹配度低也不等于不能投。合理做法是按匹配度分三档：主投、冲刺、保底，避免把全部精力压在一家公司。',
    advice: '匹配度高的岗位重点打磨简历与面试；匹配度偏低的岗位只投那些你确实想去、且愿意补短板的。',
    kind: 'own',
  },
];

// ====================== 汇总 ======================

/** 全部资源（顺序即各主题内的展示顺序） */
export const CAREER_RESOURCES: CareerResource[] = [
  ...POLICY_RESOURCES,
  ...CAMPUS_RESOURCES,
  ...GUIDE_RESOURCES,
];

/** 按主题取资源 */
export const resourcesByTheme = (theme: string): CareerResource[] =>
  CAREER_RESOURCES.filter((r) => r.theme === theme);

/** 关键词过滤：匹配标题、来源、文号、标签与正文 */
export const filterResources = (list: CareerResource[], keyword: string): CareerResource[] => {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return list;
  return list.filter((r) => {
    const haystack = [r.title, r.source, r.docNo ?? '', r.summary, r.advice ?? '', r.tags.join(' ')]
      .join(' ')
      .toLowerCase();
    return haystack.includes(kw);
  });
};
