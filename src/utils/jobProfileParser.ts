/**
 * 岗位画像 —— 本地规则解析器（兜底方案）
 *
 * 背景：计划书要求岗位画像由「阿里千问大模型」对岗位文本做结构化解析；
 * 但后端 `/api/v1/employment/job-profile/parse/task/` 接口尚未就绪，
 * 且按安全设计要求千问 API Key 不得出现在前端。
 *
 * 因此这里实现一套**完全本地、零依赖**的关键词规则解析器：
 *   1. 在千问接口就绪前，页面能真实产出十大维度画像，功能可演示、可联调；
 *   2. 千问接口异常时作为降级兜底，保证功能可用性；
 *   3. 解析结果带 source='rule' 与较低 confidence，界面对用户如实标注来源，
 *      避免把规则结果伪装成大模型结果。
 *
 * 注意：本解析器是「近似抽取」，不是语义理解。它识别不了同义表述与隐含要求，
 * 因此 professional_skill / certificate 之外的 8 个软性维度置信度天然偏低。
 */

import {
  JOB_DIMENSIONS,
  JOB_DIMENSION_KEYS,
  scoreToLevel,
  type AbilityLevel,
  type JobCertItem,
  type JobDimension,
  type JobDimensionKey,
  type JobProfile,
  type JobSkillItem,
  type RequirementStrength,
  normalizeJobProfile,
} from '@/types/jobProfile';

// ====================== 输入 ======================

/** 本地规则解析的输入（字段均可选，缺失则跳过对应文本） */
export interface RuleParseInput {
  recruitment_id: string;
  job_name?: string;
  enterprise_name?: string;
  industry?: string;
  recruit_major?: string;
  monthly_salary?: string;
  recruit_number?: string;
  enterprise_intro?: string;
  /** 预留：后端补充「岗位职责/任职要求」字段后自动纳入解析，无需改动本文件 */
  job_description?: string;
}

// ====================== 技能词典 ======================

/** 技能分类 → 关键词列表 */
const SKILL_DICTIONARY: Record<string, string[]> = {
  编程语言: [
    'Java',
    'Python',
    'C++',
    'C#',
    'JavaScript',
    'TypeScript',
    'Go',
    'PHP',
    'Kotlin',
    'Swift',
    'Scala',
    'Rust',
    'MATLAB',
    'Shell',
    'SQL',
    'R语言',
    'C语言',
    '汇编',
    'VBA',
  ],
  框架与中间件: [
    'SpringBoot',
    'Spring Boot',
    'SpringCloud',
    'Spring Cloud',
    'Spring',
    'MyBatis',
    'MyBatis-Plus',
    'Django',
    'Flask',
    'FastAPI',
    'Vue',
    'React',
    'Angular',
    'Node.js',
    'Express',
    'uni-app',
    'uniapp',
    '微信小程序',
    '微服务',
    'Kafka',
    'RabbitMQ',
    'RocketMQ',
    'Nginx',
    'Netty',
    'Dubbo',
  ],
  数据库: [
    'MySQL',
    'PostgreSQL',
    'Oracle',
    'SQL Server',
    'MongoDB',
    'Redis',
    'SQLite',
    'Elasticsearch',
    '达梦',
    '人大金仓',
    'Hive',
    'Spark',
    'Hadoop',
    'Flink',
    'ClickHouse',
  ],
  前端与设计: [
    'HTML',
    'HTML5',
    'CSS',
    'CSS3',
    'Sass',
    'Less',
    'Webpack',
    'Vite',
    'Element UI',
    'Ant Design',
    'ECharts',
    'Photoshop',
    'Illustrator',
    'Figma',
    'Axure',
    'Sketch',
    'UI设计',
    '视觉设计',
    '平面设计',
    '剪辑',
    'Premiere',
    'After Effects',
  ],
  数据与算法: [
    '机器学习',
    '深度学习',
    '神经网络',
    '自然语言处理',
    '计算机视觉',
    '数据分析',
    '数据挖掘',
    '数据可视化',
    '数据建模',
    'Pandas',
    'NumPy',
    'PyTorch',
    'TensorFlow',
    'Scikit-learn',
    'SPSS',
    'Tableau',
    'Power BI',
    'Excel',
    '数据仓库',
    'ETL',
  ],
  运维与网络: [
    'Linux',
    'Docker',
    'Kubernetes',
    'K8s',
    'Jenkins',
    'Git',
    'SVN',
    '云计算',
    '阿里云',
    '腾讯云',
    '网络安全',
    '网络工程',
    '服务器',
    'Shell脚本',
    'CI/CD',
    '监控',
    '防火墙',
    'TCP/IP',
    '路由交换',
  ],
  机械与制造: [
    'AutoCAD',
    'CAD',
    'SolidWorks',
    'UG',
    'Pro/E',
    'CATIA',
    'CAE',
    'ANSYS',
    'PLC',
    '数控',
    '机械设计',
    '机械制图',
    '电气',
    '自动化',
    '三维建模',
    '模具',
    '液压',
    '焊接',
    '工艺',
    '装配',
    '质量检测',
    '设备维护',
    '工业机器人',
    '智能制造',
  ],
  农业与食品: [
    '作物栽培',
    '育种',
    '植保',
    '土壤',
    '肥料',
    '饲料',
    '兽药',
    '畜牧',
    '养殖',
    '食品检测',
    '食品安全',
    // 已移除「农产品」：它在招聘文本里是行业/产品名词
    //（「对农业品牌与农产品行业有一定认知」），不是可衡量的技能。
    // 保留会让数据分析、市场运营类岗位凭空多出一项虚假的技能缺口。
    '温室大棚',
    '种植',
    '农业技术',
    '农机',
    '园艺',
    '园林',
    '微生物',
  ],
  经管与营销: [
    '市场营销',
    '新媒体运营',
    '电商运营',
    '国际贸易',
    '跨境电商',
    '会计',
    '财务',
    '审计',
    '税务',
    '人力资源',
    '招聘流程',
    '人才测评',
    '员工关系',
    '绩效考核',
    '客户维护',
    '商务谈判',
    '供应链',
    '物流',
    '仓储',
    '文案',
    '短视频',
    '直播',
    '社群运营',
    'SEO',
    '销售',
    '采购',
  ],
  教育与化工: [
    '教学',
    '课程设计',
    '教案',
    '班主任',
    '化学分析',
    '化工工艺',
    '化验',
    '质检',
    '仪器分析',
    '色谱',
    '滴定',
    '实验操作',
    '安全生产',
    '环境监测',
  ],
};

// ====================== 证书词典 ======================

// ====================== 复合词误命中保护 ======================

/**
 * 复合词排除表。
 *
 * 中文没有词边界，纯子串匹配会把更长词语里的一段当成独立技能：
 * 实测某中学信息技术教师岗位的「熟悉 Python 或 Scratch 等编程教学工具」中，
 * 「教学」被识别成一项**必须**技能，于是技能缺口里出现「教学」，
 * 提升建议还写着「补齐「教学」：岗位将其列为硬性要求」——
 * 对计算机专业的学生来说这是没有意义的建议。
 *
 * 处理方式：命中关键词后，若其后紧跟这些后缀，说明该次命中只是更长词的一部分，丢弃它。
 * 这是**针对已观察到的误命中**做的最小修补，不是通用分词方案；
 * 接入千问大模型解析后，这套规则连同整个本地解析器都会退居兜底。
 */
const COMPOUND_SUFFIX_BLOCK: Record<string, string[]> = {
  教学: ['工具'],
};

/** 过滤掉「只是更长词语一部分」的命中位置 */
const filterCompoundFalsePositives = (
  text: string,
  word: string,
  positions: number[]
): number[] => {
  const suffixes = COMPOUND_SUFFIX_BLOCK[word];
  if (!suffixes || !positions.length) return positions;
  return positions.filter((p) => !suffixes.some((sfx) => text.startsWith(sfx, p + word.length)));
};

const CERT_KEYWORDS: string[] = [
  '计算机二级',
  '计算机三级',
  '计算机四级',
  '英语四级',
  '英语六级',
  'CET-4',
  'CET-6',
  'CET4',
  'CET6',
  '专业四级',
  '专业八级',
  '专四',
  '专八',
  '教师资格证',
  '普通话证书',
  '初级会计',
  '中级会计',
  '会计从业资格',
  '注册会计师',
  'CPA',
  '证券从业',
  '基金从业',
  '银行从业',
  '人力资源管理师',
  '法律职业资格',
  '司法考试',
  '建造师',
  '造价工程师',
  '注册安全工程师',
  '软考',
  '软件设计师',
  '网络工程师',
  '系统集成项目管理工程师',
  '阿里云认证',
  '华为认证',
  'HCIA',
  'HCIP',
  'HCIE',
  '思科认证',
  'CCNA',
  '电工证',
  '焊工证',
  '驾驶证',
  '化学检验员',
  '食品安全管理师',
  'ISO内审员',
];

// ====================== 软性维度信号词 ======================

/** 除「专业技能」「证书要求」外的 8 个维度 → 信号词 */
const DIMENSION_SIGNALS: Partial<Record<JobDimensionKey, string[]>> = {
  innovation: [
    '创新',
    '创意',
    '研发',
    '设计',
    '优化',
    '改进',
    '迭代',
    '提案',
    '技术攻关',
    '专利',
    '新产品',
    '开发新',
  ],
  learning: [
    '学习能力',
    '学习意愿',
    '自学',
    '快速学习',
    '主动学习',
    '钻研',
    '接受新事物',
    '培训',
    '成长',
    '上进',
  ],
  stress_resistance: [
    '抗压',
    '吃苦',
    '耐劳',
    '高强度',
    '压力',
    '加班',
    '责任心',
    '敬业',
    '稳定性',
    '执行力',
    '细致',
    '踏实',
  ],
  communication: [
    '沟通',
    '表达',
    '交流',
    '协调',
    '谈判',
    '对接',
    '客户',
    '讲解',
    '演讲',
    '汇报',
    '文案',
    '服务意识',
  ],
  internship: [
    '实习',
    '实践',
    '项目经验',
    '工作经验',
    '顶岗',
    '实操',
    '动手',
    '落地',
    '案例',
    '实训',
    '在校经历',
  ],
  teamwork: ['团队', '协作', '配合', '合作', '集体', '协同', '跨部门', '组织协调'],
  logical_thinking: [
    '逻辑',
    '分析',
    '思维',
    '严谨',
    '条理',
    '数据',
    '梳理',
    '归纳',
    '解决问题',
    '推理',
  ],
  industry_cognition: [
    '行业',
    '产业',
    '市场',
    '政策',
    '趋势',
    '领域',
    '认知',
    '前沿',
    '同行业',
    '区域',
    '行情',
  ],
};

/** 「必须」类强度标记（注意：判定时先查「优先」，避免「熟悉…者优先」被误判为必须） */
const MUST_MARKERS = [
  '必须',
  '要求',
  '精通',
  '熟练',
  '熟悉',
  '掌握',
  '具备',
  '需有',
  '应具备',
  '硬性',
];
/** 「优先」类强度标记 */
const PREFERRED_MARKERS = ['优先', '加分', '更佳', '有则更好', '可选'];

/**
 * 厂商认证的通用模式。
 * 词典只能穷举固定写法，而实际文本常写作「阿里云相关认证」「华为认证」等，
 * 因此这里用模式匹配兜住「厂商名 + (相关) + 认证」这一族表述。
 */
const VENDOR_CERT_PATTERN =
  /(阿里云|华为|思科|腾讯云|红帽|Oracle|微软|Adobe|Autodesk|达索|用友|金蝶|SAP)\s*(?:相关)?\s*认证/g;

// ====================== 晋升路径模板 ======================

/** 岗位关键词 → 垂直晋升路径（为后续「岗位垂直晋升图谱」预留数据） */
const PROMOTION_TEMPLATES: Array<{ match: string[]; path: string[] }> = [
  {
    match: ['开发', '程序员', '软件工程', '后端', '前端', '全栈'],
    path: ['初级开发工程师', '开发工程师', '高级开发工程师', '技术主管', '技术总监'],
  },
  {
    match: ['测试', '质量'],
    path: ['测试工程师', '高级测试工程师', '测试主管', '质量总监'],
  },
  {
    match: ['运维', '实施', '技术支持'],
    path: ['运维工程师', '高级运维工程师', '运维主管', '技术经理'],
  },
  {
    match: ['算法', '人工智能', '机器学习'],
    path: ['算法助理', '算法工程师', '高级算法工程师', '算法专家'],
  },
  {
    match: ['数据分析', '数据开发', '大数据'],
    path: ['数据专员', '数据分析师', '高级数据分析师', '数据总监'],
  },
  {
    match: ['产品'],
    path: ['产品助理', '产品经理', '高级产品经理', '产品总监'],
  },
  {
    match: ['运营', '新媒体', '电商', '文案', '短视频'],
    path: ['运营专员', '资深运营', '运营主管', '运营总监'],
  },
  {
    match: ['销售', '市场', '商务', '客户经理'],
    path: ['销售代表', '销售主管', '区域经理', '销售总监'],
  },
  {
    match: ['机械', '工艺', '制造', '设备', '电气', '自动化'],
    path: ['助理工程师', '工程师', '高级工程师', '技术主管', '技术总监'],
  },
  {
    match: ['农业', '农艺', '种植', '养殖', '园艺'],
    path: ['农业技术员', '农业技术主管', '农艺师', '技术总监'],
  },
  {
    match: ['会计', '财务', '审计', '税务'],
    path: ['会计助理', '会计', '财务主管', '财务经理', '财务总监'],
  },
  {
    match: ['教师', '教学', '讲师', '教育', '辅导'],
    path: ['助教', '讲师', '教研主管', '教学校长'],
  },
  {
    match: ['人力', '行政', '人事'],
    path: ['人事专员', '人事主管', '人力资源经理', '人力资源总监'],
  },
  {
    match: ['化验', '质检', '检测', '化工'],
    path: ['化验员', '质检工程师', '质量主管', '质量总监'],
  },
];

// ====================== 文本工具 ======================

/** 判断字符是否属于 ASCII 单词字符（用于手写词边界判断，避免使用 lookbehind） */
const isAsciiWordChar = (ch: string | undefined): boolean => !!ch && /[A-Za-z0-9+#._-]/.test(ch);

/** 判断关键词是否为纯 ASCII（纯 ASCII 需做词边界判断，避免 Go 命中 Google） */
const isAsciiKeyword = (kw: string): boolean => /^[\x20-\x7E]+$/.test(kw);

/**
 * 在文本中查找关键词的全部出现位置。
 * 纯 ASCII 关键词做词边界校验；中文关键词直接匹配。
 */
const findOccurrences = (text: string, keyword: string): number[] => {
  if (!text || !keyword) return [];
  const positions: number[] = [];
  const lowerText = text.toLowerCase();
  const lowerKw = keyword.toLowerCase();
  const needBoundary = isAsciiKeyword(keyword);

  let from = 0;
  for (;;) {
    const idx = lowerText.indexOf(lowerKw, from);
    if (idx === -1) break;
    if (!needBoundary) {
      positions.push(idx);
    } else {
      const before = idx > 0 ? text[idx - 1] : undefined;
      const after = text[idx + keyword.length];
      if (!isAsciiWordChar(before) && !isAsciiWordChar(after)) positions.push(idx);
    }
    from = idx + lowerKw.length;
  }
  return positions;
};

/** 判断关键词是否出现在文本中 */
const hasHit = (text: string, keyword: string): boolean =>
  findOccurrences(text, keyword).length > 0;

/** 截取关键词周围片段作为证据（保证结论可追溯） */
const evidenceAround = (text: string, idx: number, keywordLength: number, window = 16): string => {
  const start = Math.max(0, idx - window);
  const end = Math.min(text.length, idx + keywordLength + window);
  const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${snippet}${end < text.length ? '…' : ''}`;
};

/** 截断长文本，避免循环开销过大 */
const clampText = (text: string, max = 6000): string =>
  text.length > max ? text.slice(0, max) : text;

// ====================== 强度判定 ======================

/**
 * 取包含指定位置的那一句（以句号/分号/换行等为界）。
 *
 * 为什么不用固定字符窗口：岗位文本常写成
 * 「任职要求：熟练掌握Java、SpringBoot、MySQL、Redis、MyBatis，熟悉Linux与Git；」
 * 固定窗口会让列表靠后的技能漏掉「熟练掌握」这个强度标记。
 * 按句子取范围，可让同一句中的并列技能共享强度标记，符合语义。
 */
const sentenceAround = (text: string, idx: number): string => {
  const BOUNDARY = /[。！？；;\n\r]/;
  let start = idx;
  while (start > 0 && !BOUNDARY.test(text[start - 1])) start -= 1;
  let end = idx;
  while (end < text.length && !BOUNDARY.test(text[end])) end += 1;
  return text.slice(start, end);
};

/**
 * 判断某个关键词在文本中的要求强度。
 * 先查「优先」类标记（「熟悉…者优先」应判为优先而非必须），再查「必须」类标记，
 * 都没有则默认 preferred —— 不擅自拔高岗位要求。
 */
const judgeStrength = (text: string, idx: number, _keywordLength: number): RequirementStrength => {
  const sentence = sentenceAround(text, idx);

  if (PREFERRED_MARKERS.some((m) => sentence.includes(m))) return 'preferred';
  if (MUST_MARKERS.some((m) => sentence.includes(m))) return 'must';
  return 'preferred';
};

/**
 * 综合某个关键词的所有出现位置，取最强的要求强度。
 * 例：Java 既出现在标题「Java开发工程师」中，又出现在「熟练掌握Java」中，
 * 只要任一位置判定为必须，整体即视为必须。
 */
const strongestStrength = (
  text: string,
  positions: number[],
  keywordLength: number
): RequirementStrength =>
  positions.some((p) => judgeStrength(text, p, keywordLength) === 'must') ? 'must' : 'preferred';

// ====================== 语料切分 ======================

/**
 * 「任职要求」段的起始标志词。
 *
 * 招聘文本通常把「干什么」和「要什么」分开写。技能必须在要求段里找，
 * 因为职责段写的是工作任务，里面的名词不都是「技能要求」。
 */
const REQUIREMENT_MARKERS = [
  '任职要求',
  '任职资格',
  '岗位要求',
  '职位要求',
  '招聘要求',
  '用人要求',
  '能力要求',
  '我们希望',
  '你需要',
];

/** 「岗位职责」段的起始标志词 */
const DUTY_MARKERS = [
  '岗位职责',
  '工作职责',
  '主要职责',
  '职责描述',
  '职位描述',
  '工作内容',
  '你将负责',
];

/**
 * 把岗位正文切成「要求段」与「职责段」。
 *
 * 为什么要切：技能词典是在整段文本上做关键词匹配的，而职责段里全是任务描述。
 * 实测一条数据分析岗的职责写着「负责农产品市场数据的采集、清洗与分析建模」，
 * 「农产品」就被当成了一项要求技能，进了技能缺口列表——
 * 这条噪声会一路污染覆盖率 → 达成度 → 匹配度 → 提升建议。
 *
 * 找不到任何标志词时按「整段都是要求段」处理（宁可宽松，
 * 也不能因为切不出来就丢掉全部要求）。
 */
export const splitJobBody = (body: string): { requirement: string; duty: string } => {
  if (!body) return { requirement: '', duty: '' };

  const firstIndexOf = (markers: string[]): number => {
    let hit = -1;
    for (const m of markers) {
      const i = body.indexOf(m);
      if (i >= 0 && (hit < 0 || i < hit)) hit = i;
    }
    return hit;
  };

  const reqIdx = firstIndexOf(REQUIREMENT_MARKERS);
  const dutyIdx = firstIndexOf(DUTY_MARKERS);

  // 两种标志词都没有：无法切分，整段当作要求段
  if (reqIdx < 0 && dutyIdx < 0) return { requirement: body, duty: '' };
  // 只有要求段
  if (dutyIdx < 0) return { requirement: body.slice(reqIdx), duty: '' };
  // 只有职责段
  if (reqIdx < 0) return { requirement: '', duty: body.slice(dutyIdx) };
  // 两段都有：按实际出现顺序切
  if (reqIdx < dutyIdx) {
    return { requirement: body.slice(reqIdx, dutyIdx), duty: body.slice(dutyIdx) };
  }
  return { requirement: body.slice(reqIdx), duty: body.slice(dutyIdx, reqIdx) };
};

// ====================== 打分曲线 ======================

/** 通用「命中数 → 分值」映射（软性维度） */
const scoreByHits = (hitCount: number): number => {
  if (hitCount <= 0) return 50;
  if (hitCount === 1) return 62;
  if (hitCount === 2) return 72;
  if (hitCount === 3) return 80;
  if (hitCount === 4) return 86;
  return 90;
};

/** 技能数量 → 分值 */
const scoreBySkillCount = (count: number, mustCount: number): number => {
  let base: number;
  if (count <= 0) base = 40;
  else if (count === 1) base = 55;
  else if (count === 2) base = 65;
  else if (count === 3) base = 72;
  else if (count === 4) base = 78;
  else if (count === 5) base = 82;
  else if (count === 6) base = 86;
  else if (count === 7) base = 89;
  else base = 92;

  // 「必须」类技能越多，说明岗位门槛越硬，分值略上调
  const bonus = Math.min(5, mustCount * 2);
  return Math.min(100, base + bonus);
};

/** 证书数量 → 分值 */
const scoreByCertCount = (count: number): number => {
  if (count <= 0) return 45;
  if (count === 1) return 58;
  if (count === 2) return 68;
  if (count === 3) return 76;
  if (count === 4) return 82;
  return 88;
};

/** 命中数 → 置信度（本地规则本身置信度不高，命中越少越低） */
const confidenceByHits = (hitCount: number): number => {
  if (hitCount <= 0) return 0.25;
  return Math.min(0.8, 0.35 + hitCount * 0.12);
};

// ====================== 抽取 ======================

/** 抽取技能清单 */
const extractSkills = (text: string): { skills: JobSkillItem[]; evidence: string[] } => {
  const skills: JobSkillItem[] = [];
  const evidence: string[] = [];

  Object.entries(SKILL_DICTIONARY).forEach(([category, words]) => {
    words.forEach((word) => {
      const rawPositions = findOccurrences(text, word);
      const positions = filterCompoundFalsePositives(text, word, rawPositions);
      if (!positions.length) return;
      // 避免同名技能重复（如 SQL 与 SQL Server 同时命中）
      if (skills.some((s) => s.name.toLowerCase() === word.toLowerCase())) return;

      skills.push({
        name: word,
        requirement: strongestStrength(text, positions, word.length),
        category,
      });

      if (evidence.length < 6) {
        evidence.push(evidenceAround(text, positions[0], word.length));
      }
    });
  });

  return { skills, evidence };
};

/**
 * 分段抽取技能。
 *
 * 两段的语义不同，强度处理也不同：
 *   - 要求段：按句内标记判定「必须 / 优先」；
 *   - 职责段：只作为补充，强度**一律降级为「优先」**。
 *     职责里写的是「你会用到什么」，不等于「入职前必须会」，
 *     把它判成硬性要求会凭空抬高岗位门槛。
 *
 * 另外，岗位名称、招聘专业、行业名都不参与技能抽取（见 parseJobProfileByRules）：
 * 「网络工程」是专业名、「智能制造」是行业名，都不是要求条目。
 */
const extractSkillsBySection = (
  requirementText: string,
  dutyText: string
): { skills: JobSkillItem[]; evidence: string[] } => {
  const primary = extractSkills(requirementText);
  const secondary = dutyText ? extractSkills(dutyText) : { skills: [], evidence: [] };

  const merged: JobSkillItem[] = [...primary.skills];
  secondary.skills.forEach((s) => {
    if (merged.some((m) => m.name.toLowerCase() === s.name.toLowerCase())) return;
    merged.push({ ...s, requirement: 'preferred' });
  });

  return {
    skills: merged,
    evidence: [...primary.evidence, ...secondary.evidence].slice(0, 6),
  };
};

/** 抽取证书清单 */
const extractCerts = (text: string): { certificates: JobCertItem[]; evidence: string[] } => {
  const certificates: JobCertItem[] = [];
  const evidence: string[] = [];

  const pushCert = (name: string, positions: number[]) => {
    if (certificates.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    certificates.push({
      name,
      requirement: strongestStrength(text, positions, name.length),
    });
    if (evidence.length < 4) {
      evidence.push(evidenceAround(text, positions[0], name.length));
    }
  };

  // 1) 固定词典匹配
  CERT_KEYWORDS.forEach((word) => {
    const positions = findOccurrences(text, word);
    if (!positions.length) return;
    pushCert(word, positions);
  });

  // 2) 厂商认证模式匹配（阿里云相关认证 / 华为认证 等）
  //
  // 这里刻意用 exec 循环而不是 String.prototype.matchAll：
  // matchAll 属于 ES2020，微信开发者工具做 ES5 转换时会为它注入
  // `@swc/helpers/_/_wrap_reg_exp`，而该 helper 不会被打进小程序产物，
  // 会导致小程序**启动即崩**：
  //   module 'common/@swc/helpers/_/_wrap_reg_exp.js' is not defined
  // exec 循环与 matchAll 语义等价，且不依赖任何需要 polyfill 的 API。
  const certPattern = new RegExp(VENDOR_CERT_PATTERN.source, 'g');
  let certMatch: RegExpExecArray | null = certPattern.exec(text);
  while (certMatch !== null) {
    const vendor = certMatch[1];
    if (vendor) pushCert(`${vendor}认证`, [certMatch.index]);
    // 零宽匹配保护，避免 lastIndex 不前进导致死循环
    if (certMatch.index === certPattern.lastIndex) certPattern.lastIndex += 1;
    certMatch = certPattern.exec(text);
  }

  return { certificates, evidence };
};

/** 抽取某个软性维度的命中证据 */
const extractDimensionEvidence = (text: string, keywords: string[]): string[] => {
  const evidence: string[] = [];
  for (const kw of keywords) {
    const positions = findOccurrences(text, kw);
    if (!positions.length) continue;
    evidence.push(evidenceAround(text, positions[0], kw.length));
    if (evidence.length >= 3) break;
  }
  return evidence;
};

/** 统计某个软性维度的命中次数（按「命中了几类信号词」计，避免同一词反复出现刷分） */
const countDimensionHits = (text: string, keywords: string[]): number =>
  keywords.reduce((count, kw) => (hasHit(text, kw) ? count + 1 : count), 0);

// ====================== 总述与路径 ======================

/** 生成画像总述 */
const buildSummary = (
  input: RuleParseInput,
  dimensions: JobDimension[],
  focusKeys: JobDimensionKey[]
): string => {
  const byKey = new Map(dimensions.map((d) => [d.key, d]));
  const labelOf = (k: JobDimensionKey) => byKey.get(k)?.label ?? k;

  const enterprise = input.enterprise_name ? `${input.enterprise_name}的` : '';
  const jobName = input.job_name || '该岗位';

  const focusText = focusKeys.length
    ? `能力侧重集中在${focusKeys.map(labelOf).join('、')}`
    : '各项能力要求相对均衡';

  const highDims = dimensions.filter((d) => d.level === 'high');
  const lowDims = dimensions.filter((d) => d.level === 'low');

  const highText = highDims.length
    ? `其中${highDims.slice(0, 3).map((d) => d.label).join('、')}要求较高`
    : '未出现明显的高要求维度';
  const lowText = lowDims.length
    ? `${lowDims.slice(0, 3).map((d) => d.label).join('、')}门槛相对宽松`
    : '各维度均有一定门槛';

  const skillDim = byKey.get('professional_skill');
  const skillText = skillDim?.skills?.length
    ? `硬技能方面共识别出 ${skillDim.skills.length} 项要求（${skillDim.skills
        .slice(0, 6)
        .map((s) => s.name)
        .join('、')}${skillDim.skills.length > 6 ? ' 等' : ''}）`
    : '暂未从现有文本中识别出明确的硬技能要求，建议补充岗位职责说明后重新解析';

  const industryText = input.industry ? `所属行业为${input.industry}。` : '';

  return (
    `${enterprise}${jobName}岗位画像：${focusText}。${highText}，${lowText}。` +
    `${skillText}。${industryText}` +
    `本画像由本地关键词规则解析生成，可作为能力对标参考；接入千问大模型解析后精度将显著提升。`
  );
};

/** 取晋升路径模板 */
const buildPromotionPath = (jobName: string): string[] => {
  const name = jobName || '';
  const matched = PROMOTION_TEMPLATES.find((t) => t.match.some((m) => name.includes(m)));
  if (matched) return [...matched.path];
  if (!name) return [];
  // 无匹配模板时给出通用路径，避免空值
  return [name, `高级${name}`, `${name}主管`, `${name}负责人`];
};

// ====================== 主入口 ======================

/**
 * 本地规则解析入口：把一条招聘原始数据解析为十大维度岗位画像。
 *
 * @param input 招聘原始数据
 * @returns 归一化后的 JobProfile（十维齐全、权重合计为 1）
 */
export const parseJobProfileByRules = (input: RuleParseInput): JobProfile => {
  // 汇总所有可用文本作为解析语料
  // 注意：招聘专业直接拼接即可，不要加「招聘专业：」这类前缀，
  // 否则前缀词本身会被技能词典误命中（例如把「招聘」识别成一项技能）。
  const corpus = clampText(
    [
      input.job_name,
      input.industry,
      input.recruit_major,
      input.enterprise_intro,
      input.job_description,
    ]
      .filter(Boolean)
      .join('\n')
  );

  // 技能 / 证书的语料与软性维度**分开**：
  //   - 只取岗位正文（enterprise_intro / job_description），
  //     排除 job_name、recruit_major、industry 这三个已单独解析的结构化字段：
  //     岗位名称里的技术词是岗位名，招聘专业里的「网络工程」是专业名，
  //     行业名「智能制造」是行业——它们都不是要求条目，
  //     混进来会虚增岗位技能清单，进而虚高覆盖率、压低学生的达成度。
  //   - 再把正文切成要求段与职责段，职责段技能降级为「优先」。
  const bodyText = clampText(
    [input.enterprise_intro, input.job_description].filter(Boolean).join('\n')
  );
  const { requirement: requirementText, duty: dutyText } = splitJobBody(bodyText);

  const { skills, evidence: skillEvidence } = extractSkillsBySection(requirementText, dutyText);
  // 证书是显式关键词，在整段正文里找即可（不限要求段，避免漏掉写在职责里的证书）
  const { certificates, evidence: certEvidence } = extractCerts(bodyText);

  const mustSkillCount = skills.filter((s) => s.requirement === 'must').length;

  const dimensions: JobDimension[] = JOB_DIMENSIONS.map((meta) => {
    // ---- 专业技能 ----
    if (meta.key === 'professional_skill') {
      const score = scoreBySkillCount(skills.length, mustSkillCount);
      return {
        key: meta.key,
        label: meta.label,
        score,
        level: scoreToLevel(score),
        weight: meta.defaultWeight,
        confidence: Math.min(0.9, 0.4 + skills.length * 0.08),
        source: 'rule' as const,
        evidence: skillEvidence,
        skills,
      };
    }

    // ---- 证书要求 ----
    if (meta.key === 'certificate') {
      const score = scoreByCertCount(certificates.length);
      return {
        key: meta.key,
        label: meta.label,
        score,
        level: scoreToLevel(score),
        weight: meta.defaultWeight,
        confidence: certificates.length
          ? Math.min(0.85, 0.4 + certificates.length * 0.15)
          : 0.3,
        source: 'rule' as const,
        evidence: certEvidence,
        certificates,
      };
    }

    // ---- 其余 8 个软性维度 ----
    const keywords = DIMENSION_SIGNALS[meta.key] ?? [];
    const hitCount = countDimensionHits(corpus, keywords);
    const score = scoreByHits(hitCount);

    return {
      key: meta.key,
      label: meta.label,
      score,
      level: scoreToLevel(score) as AbilityLevel,
      weight: meta.defaultWeight,
      confidence: confidenceByHits(hitCount),
      source: 'rule' as const,
      evidence: extractDimensionEvidence(corpus, keywords),
    };
  });

  // 能力侧重：分值最高的前 3 个维度（且需达到「较高」水平）
  const focusKeys: JobDimensionKey[] = [...dimensions]
    .sort((a, b) => b.score - a.score)
    .filter((d) => d.score >= 75)
    .slice(0, 3)
    .map((d) => d.key);

  const finalProfile = normalizeJobProfile({
    job_name: input.job_name ?? '未知岗位',
    enterprise_name: input.enterprise_name ?? '',
    industry: input.industry ?? '',
    recruit_major: input.recruit_major
      ? input.recruit_major
          .split(/[、,，;；/\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    salary_range: input.monthly_salary ?? '',
    recruit_number: input.recruit_number ?? '',
    recruitment_id: input.recruitment_id ?? '',
    dimensions,
    summary: '',
    focus_dimensions: focusKeys,
    promotion_path: buildPromotionPath(input.job_name ?? ''),
    parse_method: 'rule',
    parsed_at: new Date().toISOString(),
  });

  // summary 依赖最终维度结果，放在归一化之后生成
  finalProfile.summary = buildSummary(
    input,
    finalProfile.dimensions,
    finalProfile.focus_dimensions
  );

  return finalProfile;
};

/** 供调试/自检使用：确认十个维度 key 完整 */
export const assertDimensionsComplete = (profile: JobProfile): boolean =>
  JOB_DIMENSION_KEYS.every((key) => profile.dimensions.some((d) => d.key === key));

// ====================== 共享给「学生能力画像」的词典与文本工具 ======================
//
// 岗位画像与学生画像是同一套十维能力基准的两个侧面，必须使用同一份词典，
// 否则同一个技能可能在岗位侧被识别、在学生侧被漏掉，导致人岗匹配失真。
//
// 因此这里把通用部分集中导出，供 utils/studentProfileParser.ts 复用。
// （后续若要进一步解耦，可把这一块整体迁到 utils/abilityLexicon.ts，
//   调用方 import 路径不变即可。）
export {
  SKILL_DICTIONARY,
  CERT_KEYWORDS,
  DIMENSION_SIGNALS,
  findOccurrences,
  hasHit,
  evidenceAround,
  clampText,
  countDimensionHits,
  extractDimensionEvidence,
  scoreByHits,
  scoreBySkillCount,
  scoreByCertCount,
  confidenceByHits,
  isAsciiKeyword,
  isAsciiWordChar,
};
