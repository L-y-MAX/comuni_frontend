/**
 * 技能/证书名称归一化。
 *
 * 解析和匹配必须共用同一套归一化规则，否则：
 *   Spring Boot / SpringBoot / spring-boot
 *   JS / JavaScript
 *   计算机二级 / 全国计算机等级考试二级
 * 会被当成不同的技能，覆盖率直接被算低。
 */

const VARIANT_GROUPS: Record<string, string[]> = {
  springboot: ['SpringBoot', 'Spring Boot', 'spring-boot', 'spring boot'],
  springcloud: ['SpringCloud', 'Spring Cloud', 'spring-cloud'],
  javascript: ['JavaScript', 'JS', 'java script'],
  typescript: ['TypeScript', 'TS'],
  vue: ['Vue', 'Vue.js', 'VueJS'],
  react: ['React', 'React.js', 'ReactJS'],
  nodejs: ['Node.js', 'NodeJS', 'Node'],
  kubernetes: ['Kubernetes', 'K8s'],
  docker: ['Docker'],
  'c++': ['C++', 'CPP', 'cpp'],
  'c#': ['C#', 'CSharp', 'csharp'],
  html: ['HTML', 'HTML5'],
  css: ['CSS', 'CSS3'],
  mysql: ['MySQL', 'Mysql'],
  postgresql: ['PostgreSQL', 'Postgres', 'pgsql'],
  redis: ['Redis'],
  linux: ['Linux'],
  git: ['Git'],
  mybatis: ['MyBatis', 'mybatis'],
  '计算机二级': ['计算机二级', '全国计算机等级考试二级', '计算机等级考试二级', '计算机2级'],
  cet4: ['CET-4', 'CET4', '英语四级', '大学英语四级'],
  cet6: ['CET-6', 'CET6', '英语六级', '大学英语六级'],
  putonghua: ['普通话', '普通话证书', '普通话水平测试'],
  teacher: ['教师资格证', '教师资格证书'],
}

/** 归一化 key：小写，去空格、点、横线、下划线、括号 */
export const normalizeTerm = (value: string): string => {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s._\-/（）()]+/g, '')
  for (const [canonical, variants] of Object.entries(VARIANT_GROUPS)) {
    if (variants.some((v) => normalizeLoose(v) === key)) return canonical
  }
  return key
}

const normalizeLoose = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s._\-/（）()]+/g, '')

/** 技能名归一化 */
export const normalizeSkillName = (name: string): string => normalizeTerm(name)

/** 证书名归一化（同一套别名表） */
export const normalizeCertName = (name: string): string => normalizeTerm(name)

/**
 * 取一个词的所有常见写法，用于在文本里搜索。
 * 例如 SpringBoot → ['SpringBoot', 'Spring Boot', 'spring-boot']
 */
export const expandTermVariants = (word: string): string[] => {
  const canonical = normalizeTerm(word)
  const group = VARIANT_GROUPS[canonical]
  return group && group.length ? group : [word]
}
