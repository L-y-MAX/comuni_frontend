/**
 * 示例岗位画像集
 *
 * 用途：让「人岗智能匹配」在**后端接口/登录尚未就绪**时也能完整演示——
 * 直接用本地规则解析器把几条典型招聘文本解析成岗位画像，
 * 无需任何网络请求。
 *
 * 设计取舍：
 *   - 走 parseJobProfileByRules 而不是手写死画像数据，这样示例与真实岗位
 *     永远使用同一套解析逻辑，不会出现"示例好看、真机拉垮"的偏差；
 *   - 覆盖计算机、农业、机械、数据四个方向，方便演示不同专业学生的匹配差异；
 *   - 明确标注为示例数据，界面上与真实岗位区分展示。
 */

import type { JobProfile } from '@/types/jobProfile';
import { parseJobProfileByRules, type RuleParseInput } from '@/utils/jobProfileParser';

/**
 * 示例招聘原始数据（模拟聊城大学校招合作企业的真实招聘文本）。
 *
 * 导出原因：「岗位能力画像」页在未带岗位参数进入时需要让用户挑一个岗位，
 * 示例岗位必须与真实岗位走**同一套解析逻辑**，所以这里交出的是原始输入，
 * 而不是预先算好的解析结果。
 */
export const SAMPLE_RECRUITMENTS: RuleParseInput[] = [
  {
    recruitment_id: 'SAMPLE-JAVA-001',
    job_name: 'Java开发工程师',
    enterprise_name: '山东智造数字科技有限公司',
    industry: '数字经济',
    recruit_major: '计算机科学与技术、软件工程',
    monthly_salary: '7000-12000',
    recruit_number: '5',
    enterprise_intro:
      '岗位职责：负责公司后端系统的设计与开发，参与需求分析与技术方案优化，配合团队完成项目落地。' +
      '任职要求：熟练掌握Java、SpringBoot、MySQL、Redis、MyBatis，熟悉Linux常用命令与Git；' +
      '具有良好的沟通表达能力和团队协作精神，能承受一定工作压力，责任心强，具备较强的学习能力；' +
      '有相关实习经历或项目经验者优先；持有计算机二级证书者优先，有阿里云相关认证者优先。',
  },
  {
    recruitment_id: 'SAMPLE-DATA-002',
    job_name: '数据分析师',
    enterprise_name: '鲁西农业数字产业研究院',
    industry: '现代农业',
    recruit_major: '数据科学与大数据技术、统计学、计算机科学与技术',
    monthly_salary: '6500-10000',
    recruit_number: '3',
    enterprise_intro:
      '岗位职责：负责农产品市场数据的采集、清洗与分析建模，输出可视化分析报告支撑业务决策。' +
      '任职要求：熟悉SQL与Python，掌握Excel、Tableau或Power BI等数据可视化工具，了解统计学基础；' +
      '具备较强的逻辑思维与数据敏感度，能从数据中发现问题并提出改进建议；' +
      '有数据分析相关实习或竞赛项目经历者优先；持有计算机二级证书者优先。',
  },
  {
    recruitment_id: 'SAMPLE-MECH-003',
    job_name: '机械设计工程师',
    enterprise_name: '聊城恒力智能装备有限公司',
    industry: '智能制造',
    recruit_major: '机械设计制造及其自动化、车辆工程',
    monthly_salary: '6000-9000',
    recruit_number: '4',
    enterprise_intro:
      '岗位职责：负责非标自动化设备的机械结构设计与三维建模，使用SolidWorks、AutoCAD完成图纸绘制，' +
      '参与工艺方案改进与样机装配调试。任职要求：熟悉机械设计与机械制图，掌握SolidWorks、AutoCAD，' +
      '了解PLC与电气控制者优先；具备较强的动手实操能力与团队协作意识，工作严谨细致，能适应车间现场环境；' +
      '有机械相关实习或竞赛项目经历者优先。',
  },
  {
    recruitment_id: 'SAMPLE-BIGDATA-006',
    job_name: '大数据开发工程师',
    enterprise_name: '山东智汇数据科技有限公司',
    industry: '数字经济',
    recruit_major: '计算机科学与技术、数据科学与大数据技术、软件工程',
    monthly_salary: '8000-14000',
    recruit_number: '3',
    enterprise_intro:
      '岗位职责：负责数据仓库与离线、实时数据链路的开发维护，完成数据采集、清洗、建模与调度。' +
      '任职要求：熟练掌握Java与SQL，熟悉Hadoop、Spark、Hive，了解Flink与Kafka；' +
      '熟悉Linux常用命令与Git，具备较强的逻辑思维与数据分析能力；' +
      '有大数据相关实习或项目经验者优先；持有计算机二级证书者优先。',
  },
  {
    recruitment_id: 'SAMPLE-QATEST-007',
    job_name: '测试开发工程师',
    enterprise_name: '聊城云启软件技术有限公司',
    industry: '数字经济',
    recruit_major: '计算机科学与技术、软件工程、网络工程',
    monthly_salary: '6500-11000',
    recruit_number: '4',
    enterprise_intro:
      '岗位职责：负责自动化测试框架搭建与用例开发，参与需求评审与缺陷跟踪，保障版本质量。' +
      '任职要求：熟练掌握Java或Python，熟悉MySQL与Linux，了解Selenium、JUnit等测试工具；' +
      '掌握Git协作流程，工作严谨细致，具备良好的沟通能力与团队协作精神；' +
      '有测试相关实习或项目经验者优先；持有计算机二级证书者优先。',
  },
  {
    recruitment_id: 'SAMPLE-MEDIA-004',
    job_name: '新媒体运营专员',
    enterprise_name: '聊城农谷品牌管理有限公司',
    industry: '现代农业',
    recruit_major: '市场营销、新闻传播学、汉语言文学',
    monthly_salary: '4500-7000',
    recruit_number: '2',
    enterprise_intro:
      '岗位职责：负责公司抖音、小红书等平台的内容策划与文案撰写，独立完成短视频脚本与剪辑，' +
      '策划直播活动并跟进社群运营数据。任职要求：具备较强的文案表达与沟通协调能力，' +
      '对农业品牌与农产品行业有一定认知，善于捕捉市场趋势；工作主动，学习能力强，能承受节点压力；' +
      '有新媒体运营相关实习经历者优先。',
  },
  {
    recruitment_id: 'SAMPLE-TEACH-005',
    job_name: '中学信息技术教师',
    enterprise_name: '聊城市东昌府区某中学',
    industry: '教育文旅',
    recruit_major: '计算机科学与技术、教育技术学、软件工程',
    monthly_salary: '5000-8000',
    recruit_number: '2',
    enterprise_intro:
      '岗位职责：承担中学信息技术课程教学与教研工作，负责课程设计、教案编写与学生竞赛辅导。' +
      '任职要求：具备教师资格证与普通话证书，熟悉Python或Scratch等编程教学工具；' +
      '有较强的语言表达能力与责任心，善于沟通，能耐心指导学生；' +
      '有支教、家教或教学实习经历者优先。',
  },
];

/** 缓存的示例岗位画像（规则解析有一定开销，只算一次） */
let cachedSamples: JobProfile[] | null = null;

/** 取示例岗位画像集 */
export const getSampleJobProfiles = (): JobProfile[] => {
  if (!cachedSamples) {
    cachedSamples = SAMPLE_RECRUITMENTS.map((r) => parseJobProfileByRules(r));
  }
  return cachedSamples;
};

/** 判断某个岗位标识是否为示例数据 */
export const isSampleJobId = (jobId: string): boolean =>
  jobId.startsWith('SAMPLE-');
