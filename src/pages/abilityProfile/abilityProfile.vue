<template>
  <view class="ability-page">
    <scroll-view
      scroll-y
      class="page-scroll"
    >
      <!-- ========== 顶部说明 ========== -->
      <view class="intro-card card-style">
        <text class="intro-title">学生就业能力画像</text>
        <text class="intro-desc">
          填写你的专业背景、技能证书、项目与实习经历，系统将从十大维度评估你的就业能力，
          生成能力星球图与职业徽章墙，并给出信息完整度与综合竞争力评分。
        </text>
      </view>

      <!-- ========== 快捷入口（常驻顶部，未生成画像时也能直达） ========== -->
      <view class="quick-card card-style">
        <view class="card-head">
          <text class="section-title">快捷入口</text>
          <text class="section-sub">常用功能一键直达</text>
        </view>
        <view class="quick-grid">
          <view
            class="quick-item"
            @click="goCareerReport"
          >
            <view class="quick-icon icon-report">📄</view>
            <view class="quick-text">
              <text class="quick-label">生涯发展报告</text>
              <text class="quick-desc">职业路径与成长计划</text>
            </view>
          </view>
          <view
            class="quick-item"
            @click="goJobMatch"
          >
            <view class="quick-icon icon-match">🎯</view>
            <view class="quick-text">
              <text class="quick-label">人岗智能匹配</text>
              <text class="quick-desc">看适合投哪些岗位</text>
            </view>
          </view>
          <view
            class="quick-item"
            @click="goReportHistory"
          >
            <view class="quick-icon icon-history">🕘</view>
            <view class="quick-text">
              <text class="quick-label">历史报告</text>
              <text class="quick-desc">回看与趋势对比</text>
            </view>
          </view>
          <view
            class="quick-item"
            @click="goRecruitment"
          >
            <view class="quick-icon icon-job">💼</view>
            <view class="quick-text">
              <text class="quick-label">招聘信息</text>
              <text class="quick-desc">校招企业与岗位</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ========== 录入表单 ========== -->
      <view class="form-card card-style">
        <view class="card-head">
          <text class="section-title">填写我的信息</text>
          <text
            class="sample-btn"
            @click="fillSample"
          >
            填入示例
          </text>
        </view>

        <!-- 基本信息 -->
        <view
          class="group-head"
          @click="toggleGroup('basic')"
        >
          <text class="group-title">基本信息</text>
          <text
            class="group-arrow"
            :class="{ expanded: groupOpen.basic }"
          >
            ▶
          </text>
        </view>
        <view
          v-if="groupOpen.basic"
          class="group-body"
        >
          <view class="field">
            <text class="field-label">专业</text>
            <input
              v-model="form.major"
              class="field-input"
              placeholder="如：软件工程"
              placeholder-class="ph"
            />
          </view>
          <view class="field">
            <text class="field-label">年级</text>
            <picker
              mode="selector"
              :range="gradeRange"
              :value="gradeIndex"
              @change="onGradeChange"
            >
              <view class="field-input select">
                {{ form.grade ? gradeLabelText : '请选择年级' }}
              </view>
            </picker>
          </view>
          <view class="field">
            <text class="field-label">意向岗位</text>
            <input
              v-model="form.target_job"
              class="field-input"
              placeholder="如：Java开发工程师"
              placeholder-class="ph"
            />
          </view>
          <view class="field">
            <text class="field-label">意向行业</text>
            <input
              v-model="form.target_industry"
              class="field-input"
              placeholder="如：数字经济"
              placeholder-class="ph"
            />
          </view>
        </view>

        <!-- 能力信息 -->
        <view
          class="group-head"
          @click="toggleGroup('ability')"
        >
          <text class="group-title">能力与经历</text>
          <text
            class="group-arrow"
            :class="{ expanded: groupOpen.ability }"
          >
            ▶
          </text>
        </view>
        <view
          v-if="groupOpen.ability"
          class="group-body"
        >
          <view class="field">
            <text class="field-label">专业技能</text>
            <textarea
              v-model="form.skills_text"
              class="field-textarea"
              placeholder="如：熟练使用 Java、SpringBoot、MySQL；了解 Redis、Vue"
              placeholder-class="ph"
              :maxlength="1500"
            />
          </view>
          <view class="field">
            <text class="field-label">证书资质</text>
            <textarea
              v-model="form.certificates_text"
              class="field-textarea"
              placeholder="如：计算机二级、英语四级、阿里云认证"
              placeholder-class="ph"
              :maxlength="1000"
            />
          </view>
          <view class="field">
            <text class="field-label">项目经历</text>
            <textarea
              v-model="form.projects_text"
              class="field-textarea"
              placeholder="如：大创项目负责人，负责需求分析与后端接口开发"
              placeholder-class="ph"
              :maxlength="2000"
            />
          </view>
          <view class="field">
            <text class="field-label">实习/实践</text>
            <textarea
              v-model="form.internships_text"
              class="field-textarea"
              placeholder="如：2025年暑期在某公司实习两个月，参与后台维护"
              placeholder-class="ph"
              :maxlength="2000"
            />
          </view>
        </view>

        <!-- 补充信息 -->
        <view
          class="group-head"
          @click="toggleGroup('extra')"
        >
          <text class="group-title">补充信息（选填，填得越全评分越准）</text>
          <text
            class="group-arrow"
            :class="{ expanded: groupOpen.extra }"
          >
            ▶
          </text>
        </view>
        <view
          v-if="groupOpen.extra"
          class="group-body"
        >
          <view class="field">
            <text class="field-label">获奖情况</text>
            <textarea
              v-model="form.awards_text"
              class="field-textarea"
              placeholder="如：校级一等奖学金、蓝桥杯省赛三等奖"
              placeholder-class="ph"
              :maxlength="1000"
            />
          </view>
          <view class="field">
            <text class="field-label">成绩/GPA</text>
            <input
              v-model="form.gpa"
              class="field-input"
              placeholder="如：3.6/4.0，专业排名前20%"
              placeholder-class="ph"
            />
          </view>
          <view class="field">
            <text class="field-label">自我评价</text>
            <textarea
              v-model="form.self_evaluation"
              class="field-textarea"
              placeholder="如：学习能力强，能承受交付压力，乐于团队配合"
              placeholder-class="ph"
              :maxlength="1000"
            />
          </view>
        </view>

        <!-- 操作 -->
        <view class="action-row">
          <button
            class="ghost-btn"
            @click="clearForm"
          >
            清空
          </button>
          <button
            class="primary-btn"
            :disabled="loading"
            @click="generate()"
          >
            {{ loading ? '生成中…' : '生成能力画像' }}
          </button>
        </view>

        <text
          v-if="formError"
          class="form-error"
        >
          {{ formError }}
        </text>
      </view>

      <!-- ========== 生成中 ========== -->
      <view
        v-if="loading"
        class="state-card card-style"
      >
        <view class="spinner" />
        <text class="state-title">正在生成能力画像</text>
        <text class="state-desc">{{ progressText || '正在读取信息…' }}</text>
      </view>

      <!-- ========== 错误 ========== -->
      <view
        v-else-if="errorMsg"
        class="state-card card-style"
      >
        <text class="state-title">生成失败</text>
        <text class="state-desc">{{ errorMsg }}</text>
      </view>

      <!-- ========== 画像结果 ========== -->
      <block v-if="profile && !loading">
        <!-- 双评分 -->
        <view class="score-card card-style">
          <view class="score-item">
            <text class="score-num completeness">{{ profile.completeness }}</text>
            <text class="score-label">信息完整度</text>
            <view class="score-bar">
              <view
                class="score-bar-fill completeness"
                :style="{ width: `${profile.completeness}%` }"
              />
            </view>
          </view>
          <view class="score-divider" />
          <view class="score-item">
            <text
              class="score-num"
              :style="{ color: levelColor(profile.competitiveness_level) }"
            >
              {{ profile.competitiveness }}
            </text>
            <text class="score-label">综合就业竞争力</text>
            <view class="score-bar">
              <view
                class="score-bar-fill"
                :style="{
                  width: `${profile.competitiveness}%`,
                  backgroundColor: levelColor(profile.competitiveness_level),
                }"
              />
            </view>
          </view>
        </view>

        <!-- 解析来源 -->
        <view
          class="source-card card-style"
          :class="{ degraded: isDegraded }"
        >
          <view class="source-head">
            <text class="source-badge">{{ sourceLabel }}</text>
            <text class="source-confidence">置信度 {{ confidencePercent }}%</text>
          </view>
          <text
            v-if="isDegraded"
            class="source-note"
          >
            千问解析接口暂不可用（{{ degradedReason }}），当前结果由本地关键词规则解析生成，
            仅依据你填写内容中明确出现的表述，建议后端接口就绪后重新生成。
          </text>
          <text
            v-else
            class="source-note"
          >
            本画像由阿里千问大模型对你填写的经历做结构化抽取与量化评估生成。
          </text>
        </view>

        <!-- 能力星球图 -->
        <view class="chart-card card-style">
          <view class="card-head">
            <text class="section-title">能力星球图</text>
            <text class="section-sub">星球越大越亮 = 该项能力越强</text>
          </view>

          <view class="planet-chart">
            <view
              v-for="(ring, ri) in layout.rings"
              :key="`ring-${ri}`"
              class="orbit-ring"
              :style="{ width: `${ring * 2}%`, height: `${ring * 2}%` }"
            />

            <view
              class="planet-core"
              :style="{ width: `${layout.coreSizeRpx}rpx`, height: `${layout.coreSizeRpx}rpx` }"
            >
              <text class="core-score">{{ profile.competitiveness }}</text>
              <text class="core-label">综合竞争力</text>
            </view>

            <view
              v-for="node in layout.nodes"
              :key="node.key"
              class="planet"
              :style="{ left: `${node.xPercent}%`, top: `${node.yPercent}%` }"
            >
              <view
                class="planet-body"
                :style="{
                  width: `${node.sizeRpx}rpx`,
                  height: `${node.sizeRpx}rpx`,
                  opacity: node.brightness,
                  background: planetGradient(node),
                  boxShadow: planetGlow(node),
                }"
              />
              <text class="planet-label">{{ node.label }}</text>
              <text
                class="planet-score"
                :style="{ color: levelColor(node.level) }"
              >
                {{ node.score }}
              </text>
            </view>
          </view>
        </view>

        <!-- 十维明细 -->
        <view class="dim-card card-style">
          <view class="card-head">
            <text class="section-title">十大维度明细</text>
            <text class="section-sub">点击可查看解析依据</text>
          </view>

          <view
            v-for="dim in profile.dimensions"
            :key="dim.key"
            class="dim-item"
            @click="toggleDim(dim.key)"
          >
            <view class="dim-head">
              <view class="dim-title-wrap">
                <text class="dim-label">{{ dim.label }}</text>
                <text
                  v-if="dim.confidence < 0.35"
                  class="dim-hint"
                >
                  信息不足
                </text>
              </view>
              <view class="dim-value-wrap">
                <text
                  class="dim-level"
                  :style="{ color: levelColor(dim.level) }"
                >
                  {{ levelLabel(dim.level) }}
                </text>
                <text class="dim-score">{{ dim.score }}</text>
                <text
                  class="dim-arrow"
                  :class="{ expanded: expandedKey === dim.key }"
                >
                  ▶
                </text>
              </view>
            </view>

            <view class="bar-track">
              <view
                class="bar-fill"
                :style="{
                  width: `${dim.score}%`,
                  backgroundColor: levelColor(dim.level),
                }"
              />
            </view>

            <!-- 专业技能清单 -->
            <view
              v-if="dim.key === 'professional_skill' && dim.skills && dim.skills.length"
              class="chip-group"
            >
              <text
                v-for="(s, i) in dim.skills"
                :key="`${s.name}-${i}`"
                class="chip"
                :class="s.proficiency"
              >
                {{ s.name }}<text v-if="s.proficiency === 'proficient'"> ·熟练</text>
              </text>
            </view>

            <!-- 证书清单 -->
            <view
              v-if="dim.key === 'certificate'"
              class="chip-group"
            >
              <text
                v-if="!dim.certificates || !dim.certificates.length"
                class="empty-note"
              >
                暂未识别到证书，建议补充
              </text>
              <text
                v-for="(c, i) in dim.certificates || []"
                :key="`${c.name}-${i}`"
                class="chip"
              >
                {{ c.name }}
              </text>
            </view>

            <!-- 展开：依据 -->
            <view
              v-if="expandedKey === dim.key"
              class="evidence-box"
            >
              <text class="evidence-title">解析依据（置信度 {{ Math.round(dim.confidence * 100) }}%）</text>
              <text
                v-if="!dim.evidence.length"
                class="empty-note"
              >
                你填写的内容中未出现该维度的明确表述，当前为中性基准分。
                补充相关经历后重新生成即可。
              </text>
              <text
                v-for="(e, i) in dim.evidence"
                :key="i"
                class="evidence-line"
              >
                · {{ e }}
              </text>
            </view>
          </view>
        </view>

        <!-- 徽章墙 -->
        <view class="badge-card card-style">
          <view class="card-head">
            <text class="section-title">职业徽章墙</text>
            <text class="section-sub">
              已点亮 {{ unlockedCount }} / {{ profile.badges.length }}
            </text>
          </view>
          <view class="badge-grid">
            <view
              v-for="badge in profile.badges"
              :key="badge.id"
              class="badge-item"
              :class="{ unlocked: badge.unlocked }"
            >
              <view
                class="badge-icon"
                :class="{ unlocked: badge.unlocked }"
              >
                <text class="badge-emoji">{{ badge.icon }}</text>
              </view>
              <text class="badge-name">{{ badge.name }}</text>
              <text class="badge-cond">{{ badge.condition }}</text>
            </view>
          </view>
        </view>

        <!-- 优势 / 短板 -->
        <view class="advice-card card-style">
          <view class="card-head">
            <text class="section-title">优势与短板</text>
          </view>
          <view class="advice-row">
            <text class="advice-label">优势</text>
            <view class="advice-tags">
              <text
                v-if="!strengthLabels.length"
                class="empty-note"
              >
                暂未识别出达到「良好」的维度
              </text>
              <text
                v-for="(s, i) in strengthLabels"
                :key="`s-${i}`"
                class="advice-tag strength"
              >
                {{ s }}
              </text>
            </view>
          </view>
          <view class="advice-row">
            <text class="advice-label">待提升</text>
            <view class="advice-tags">
              <text
                v-if="!weaknessLabels.length"
                class="empty-note"
              >
                暂未识别出明显短板
              </text>
              <text
                v-for="(w, i) in weaknessLabels"
                :key="`w-${i}`"
                class="advice-tag weakness"
              >
                {{ w }}
              </text>
            </view>
          </view>

          <!-- 缺失信息引导 -->
          <view
            v-if="profile.missing_fields.length"
            class="missing-box"
          >
            <text class="missing-title">还缺这些信息，补全后评分更准：</text>
            <view class="chip-group">
              <text
                v-for="(m, i) in profile.missing_fields"
                :key="`m-${i}`"
                class="chip missing"
              >
                {{ m }}
              </text>
            </view>
          </view>
        </view>

        <!-- 总述 -->
        <view
          v-if="profile.summary"
          class="summary-card card-style"
        >
          <text class="section-title">画像总述</text>
          <text class="summary-text">{{ profile.summary }}</text>
        </view>

        <!-- 结果区操作 -->
        <view class="action-row">
          <button
            class="ghost-btn"
            @click="scrollToForm"
          >
            返回修改
          </button>
          <button
            class="primary-btn"
            @click="generate({ forceLocal: true })"
          >
            本地规则重算
          </button>
        </view>
      </block>

      <view class="page-footer-source">
        <text class="source-text">
          能力画像仅用于生涯规划参考，不作为任何招聘录用的依据
        </text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onUnload, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import {
  GRADE_LABEL,
  GRADE_OPTIONS,
  STUDENT_PROFILE_STORAGE_KEY,
  type GradeKey,
  type StudentProfile,
  type StudentProfileInput,
} from '@/types/studentProfile';
import { LEVEL_LABEL, PARSE_SOURCE_LABEL, type AbilityDimensionKey } from '@/types/jobProfile';
import { buildPlanetLayout, type PlanetNode } from '@/utils/abilityPlanet';
import { generateStudentProfile, fetchSavedStudentProfile } from '@/api/studentProfile';
import { STUDENT_PROFILE_SAMPLE } from '@/utils/studentProfileParser';

// ====================== 表单 ======================

const createEmptyForm = (): StudentProfileInput => ({
  student_id: '',
  major: '',
  grade: '',
  target_job: '',
  target_industry: '',
  skills_text: '',
  certificates_text: '',
  projects_text: '',
  internships_text: '',
  awards_text: '',
  gpa: '',
  self_evaluation: '',
});

const form = ref<StudentProfileInput>(createEmptyForm());
const formError = ref('');
const groupOpen = ref<Record<string, boolean>>({
  basic: true,
  ability: true,
  extra: false,
});

const gradeRange = GRADE_OPTIONS.map((g) => GRADE_LABEL[g]);
const gradeIndex = computed(() =>
  form.value.grade ? Math.max(0, GRADE_OPTIONS.indexOf(form.value.grade as GradeKey)) : 0
);
const gradeLabelText = computed(() =>
  form.value.grade ? GRADE_LABEL[form.value.grade as GradeKey] : ''
);

const onGradeChange = (e: { detail: { value: number | string } }) => {
  const idx = Number(e.detail.value);
  form.value.grade = GRADE_OPTIONS[idx] ?? '';
};

const toggleGroup = (key: string) => {
  groupOpen.value[key] = !groupOpen.value[key];
};

// ====================== 页面状态 ======================

const loading = ref(false);
const errorMsg = ref('');
const progressText = ref('');
const degradedReason = ref('');
const profile = ref<StudentProfile | null>(null);
const expandedKey = ref<AbilityDimensionKey | null>(null);

let inFlight = false;
let unloaded = false;

onUnload(() => {
  unloaded = true;
});

const STORAGE_KEY = 'studentAbilityProfile';

// ====================== 派生数据 ======================

/** 星球图布局（纯函数计算，见 utils/abilityPlanet.ts） */
const layout = computed(() =>
  buildPlanetLayout(
    (profile.value?.dimensions ?? []).map((d) => ({
      key: d.key,
      label: d.label,
      score: d.score,
      level: d.level,
    }))
  )
);

const isDegraded = computed(() => !!degradedReason.value);

const sourceLabel = computed(() =>
  profile.value ? PARSE_SOURCE_LABEL[profile.value.parse_method] : ''
);

const confidencePercent = computed(() =>
  profile.value ? Math.round(profile.value.confidence * 100) : 0
);

const unlockedCount = computed(
  () => (profile.value?.badges ?? []).filter((b) => b.unlocked).length
);

const dimensionLabelOf = (key: AbilityDimensionKey): string =>
  profile.value?.dimensions.find((d) => d.key === key)?.label ?? key;

const strengthLabels = computed(() => (profile.value?.strengths ?? []).map(dimensionLabelOf));
const weaknessLabels = computed(() => (profile.value?.weaknesses ?? []).map(dimensionLabelOf));

// ====================== 展示辅助 ======================

const levelLabel = (level: 'high' | 'medium' | 'low'): string => LEVEL_LABEL[level] ?? '中';

const levelColor = (level: 'high' | 'medium' | 'low'): string => {
  if (level === 'high') return '#ff4500';
  if (level === 'medium') return '#f59e0b';
  return '#94a3b8';
};

/** 星球底色（径向渐变模拟球体受光） */
const planetGradient = (node: PlanetNode): string => {
  const color = levelColor(node.level);
  return `radial-gradient(circle at 32% 28%, #ffffff 0%, ${color} 52%, rgba(0,0,0,0.28) 100%)`;
};

/** 星球光晕（越强越亮） */
const planetGlow = (node: PlanetNode): string => {
  const color = levelColor(node.level);
  const spread = Math.round(6 + 18 * node.brightness);
  return `0 0 ${spread}rpx ${color}66`;
};

const toggleDim = (key: AbilityDimensionKey) => {
  expandedKey.value = expandedKey.value === key ? null : key;
};

const scrollToForm = () => {
  uni.pageScrollTo({ scrollTop: 0, duration: 200 });
};

/** 统一的页面跳转（带失败提示，避免点了没反应） */
const navTo = (url: string, label: string) => {
  uni.navigateTo({
    url,
    fail: (err) => {
      console.error(`跳转${label}失败：`, err);
      uni.showToast({ title: '页面跳转失败', icon: 'none', duration: 2000 });
    },
  });
};

/** 历史报告列表 */
const goReportHistory = () => navTo('/pagesMember/reportHistory/reportHistory', '历史报告');

/** 招聘信息列表 */
const goRecruitment = () => navTo('/pagesMember/recruitment/recruitment-list', '招聘信息');

/** 跳转到人岗匹配页（复用本地已保存的画像，离线可用） */
const goJobMatch = () => {
  uni.navigateTo({ url: '/pagesMember/jobMatch/jobMatch' });
};

/** 跳转到生涯发展报告页 */
const goCareerReport = () => {
  uni.navigateTo({ url: '/pagesMember/careerReport/careerReport' });
};

// ====================== 表单操作 ======================

const fillSample = () => {
  form.value = { ...STUDENT_PROFILE_SAMPLE };
  formError.value = '';
  uni.showToast({ title: '已填入示例数据', icon: 'none', duration: 1500 });
};

const clearForm = () => {
  form.value = createEmptyForm();
  formError.value = '';
  profile.value = null;
  errorMsg.value = '';
  degradedReason.value = '';
  uni.removeStorageSync(STORAGE_KEY);
};

// ====================== 生成 ======================

const generate = async (opts: { forceLocal?: boolean } = {}) => {
  if (inFlight) return;

  // 最小必填校验：没有专业和技能，画像毫无意义，直接拦下避免产出误导性结果
  if (!form.value.major.trim()) {
    formError.value = '请先填写「专业」';
    return;
  }
  if (!form.value.skills_text.trim()) {
    formError.value = '请至少填写「专业技能」';
    return;
  }
  formError.value = '';

  inFlight = true;
  loading.value = true;
  errorMsg.value = '';
  degradedReason.value = '';
  expandedKey.value = null;

  try {
    progressText.value = '正在读取信息…';
    const result = await generateStudentProfile(
      { ...form.value },
      {
        // 每次都按当前表单重算，避免读到上一次的旧画像
        useCache: false,
        forceLocal: opts.forceLocal,
        shouldStop: () => unloaded,
        onProgress: (msg) => {
          progressText.value = msg;
        },
      }
    );

    profile.value = result.profile;
    degradedReason.value = result.degraded ? result.degradedReason || '接口未就绪' : '';
    saveToStorage(result.profile);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    errorMsg.value = err instanceof Error ? err.message : '生成能力画像失败';
  } finally {
    inFlight = false;
    loading.value = false;
    progressText.value = '';
  }
};

// ====================== 本地缓存 ======================

const saveToStorage = (p: StudentProfile) => {
  try {
    uni.setStorageSync(STORAGE_KEY, p);
  } catch {
    // 存储失败不影响展示
  }
};

const readFromStorage = (): StudentProfile | null => {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY);
    return raw && typeof raw === 'object' ? (raw as StudentProfile) : null;
  } catch {
    return null;
  }
};

// ====================== 生命周期 ======================

onLoad(async () => {
  // 1) 优先用本地缓存，刷新/重进页面不必重算
  const cached = readFromStorage();
  if (cached) {
    profile.value = cached;
    return;
  }

  // 2) 没有本地缓存，尝试拉取后端已保存的画像
  //    （未登录或接口未就绪时会静默失败，不影响填写表单）
  try {
    const saved = await fetchSavedStudentProfile();
    if (saved) {
      profile.value = saved;
      saveToStorage(saved);
    }
  } catch {
    // 忽略：无登录态或接口未实现都属正常情况
  }
});

// ====================== 分享 ======================

onShareAppMessage(() => ({
  title: profile.value
    ? `我的就业竞争力评分 ${profile.value.competitiveness} 分`
    : '测一测你的就业能力画像',
  path: '/pages/abilityProfile/abilityProfile',
}));

onShareTimeline(() => ({
  title: '十大维度评估你的就业能力，生成能力星球图',
  path: '/pages/abilityProfile/abilityProfile',
}));
</script>

<style scoped lang="scss">
.ability-page {
  min-height: 100vh;
  background: #f8fafc;
  -webkit-tap-highlight-color: transparent;
}

.page-scroll {
  height: 100vh;
  padding: 20rpx;
  box-sizing: border-box;
}

.card-style {
  background: #fff;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.section-sub {
  font-size: 22rpx;
  color: #9ca3af;
}

// ========== 顶部说明 ==========
.intro-card {
  background: linear-gradient(135deg, #fff5f1 0%, #fff 100%);
  border-color: #ffd9c7;
}

.intro-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #ff4500;
  display: block;
}

.intro-desc {
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.7;
  margin-top: 12rpx;
  display: block;
}

// ========== 表单 ==========
.sample-btn {
  font-size: 24rpx;
  color: #ff4500;
  border: 2rpx solid #ff4500;
  border-radius: 24rpx;
  padding: 4rpx 20rpx;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 0 12rpx;
  border-bottom: 1rpx solid #f1f5f9;
}

.group-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #374151;
}

.group-arrow {
  font-size: 20rpx;
  color: #cbd5e1;
  transition: transform 0.3s ease;

  &.expanded {
    transform: rotate(90deg);
  }
}

.group-body {
  padding-top: 8rpx;
}

.field {
  margin-top: 18rpx;
}

.field-label {
  font-size: 24rpx;
  color: #6b7280;
  display: block;
  margin-bottom: 8rpx;
}

.field-input {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  background: #f8fafc;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #1f2937;

  &.select {
    color: #1f2937;
  }
}

.field-textarea {
  width: 100%;
  min-height: 150rpx;
  padding: 18rpx 20rpx;
  box-sizing: border-box;
  background: #f8fafc;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.6;
}

.ph {
  color: #b6bec9;
  font-size: 24rpx;
}

.form-error {
  font-size: 24rpx;
  color: #dc2626;
  margin-top: 16rpx;
  display: block;
}

// ========== 按钮 ==========
.action-row {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.primary-btn,
.ghost-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  margin: 0;
  padding: 0;

  &::after {
    border: none;
  }
}

.primary-btn {
  background: #ff4500;
  color: #fff;

  &[disabled] {
    background: #ffb499;
    color: #fff;
  }
}

.ghost-btn {
  background: #fff;
  color: #ff4500;
  border: 2rpx solid #ff4500;
}

// ========== 状态卡 ==========
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx;
}

.state-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 14rpx;
}

.state-desc {
  font-size: 25rpx;
  color: #6b7280;
  text-align: center;
  line-height: 1.6;
}

.spinner {
  width: 54rpx;
  height: 54rpx;
  border: 5rpx solid #ffe0d3;
  border-top-color: #ff4500;
  border-radius: 50%;
  margin-bottom: 26rpx;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// ========== 双评分 ==========
.score-card {
  display: flex;
  align-items: center;
}

.score-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.score-divider {
  width: 1rpx;
  height: 100rpx;
  background: #f1f5f9;
}

.score-num {
  font-size: 56rpx;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.1;

  &.completeness {
    color: #0ea5e9;
  }
}

.score-label {
  font-size: 23rpx;
  color: #6b7280;
  margin-top: 8rpx;
}

.score-bar {
  width: 160rpx;
  height: 10rpx;
  background: #f1f5f9;
  border-radius: 5rpx;
  margin-top: 14rpx;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 5rpx;

  &.completeness {
    background: #0ea5e9;
  }
}

// ========== 解析来源 ==========
.source-card {
  background: #f0f9ff;
  border-color: #bae6fd;

  &.degraded {
    background: #fffbeb;
    border-color: #fde68a;
  }
}

.source-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.source-badge {
  font-size: 24rpx;
  font-weight: 700;
  color: #ff4500;
}

.source-confidence {
  font-size: 22rpx;
  color: #6b7280;
}

.source-note {
  font-size: 23rpx;
  color: #6b7280;
  line-height: 1.6;
  margin-top: 12rpx;
  display: block;
}

// ========== 星球图 ==========
.planet-chart {
  position: relative;
  width: 100%;
  height: 700rpx;
  margin-top: 20rpx;
}

.orbit-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1rpx dashed rgba(255, 69, 0, 0.16);
}

.planet-core {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #ffd9c7 0%, #ff4500 46%, #b32d00 100%);
  box-shadow: 0 0 46rpx rgba(255, 69, 0, 0.42);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.core-score {
  font-size: 52rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1.1;
}

.core-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 4rpx;
}

.planet {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
}

.planet-body {
  border-radius: 50%;
  transition: opacity 0.4s ease;
}

.planet-label {
  font-size: 19rpx;
  color: #6b7280;
  margin-top: 6rpx;
  white-space: nowrap;
}

.planet-score {
  font-size: 20rpx;
  font-weight: 700;
}

// ========== 十维明细 ==========
.dim-item {
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
}

.dim-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dim-title-wrap {
  display: flex;
  align-items: center;
}

.dim-label {
  font-size: 28rpx;
  color: #1f2937;
  font-weight: 600;
}

.dim-hint {
  font-size: 19rpx;
  color: #94a3b8;
  background: #f1f5f9;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  margin-left: 12rpx;
}

.dim-value-wrap {
  display: flex;
  align-items: baseline;
}

.dim-level {
  font-size: 26rpx;
  font-weight: 700;
}

.dim-score {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
  margin-left: 10rpx;
}

.dim-arrow {
  font-size: 18rpx;
  color: #cbd5e1;
  margin-left: 12rpx;
  transition: transform 0.3s ease;

  &.expanded {
    transform: rotate(90deg);
  }
}

.bar-track {
  height: 12rpx;
  background: #f1f5f9;
  border-radius: 6rpx;
  margin-top: 14rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.4s ease;
}

// ========== chips ==========
.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.chip {
  font-size: 22rpx;
  border-radius: 8rpx;
  padding: 4rpx 14rpx;
  background: #f1f5f9;
  color: #475569;

  &.proficient {
    background: #fff1eb;
    color: #ff4500;
    font-weight: 600;
  }

  &.missing {
    background: #fef2f2;
    color: #dc2626;
  }
}

.empty-note {
  font-size: 22rpx;
  color: #9ca3af;
  line-height: 1.6;
  display: block;
}

// ========== 依据 ==========
.evidence-box {
  margin-top: 16rpx;
  background: #f8fafc;
  border-left: 6rpx solid #ffd0bb;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
}

.evidence-title {
  font-size: 22rpx;
  color: #6b7280;
  font-weight: 600;
  display: block;
  margin-bottom: 8rpx;
}

.evidence-line {
  font-size: 22rpx;
  color: #475569;
  line-height: 1.7;
  display: block;
}

// ========== 徽章墙 ==========
.badge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx 0;
  margin-top: 20rpx;
}

.badge-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.42;

  &.unlocked {
    opacity: 1;
  }
}

.badge-icon {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: #f1f5f9;
  border: 2rpx solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;

  &.unlocked {
    background: linear-gradient(135deg, #fff1eb 0%, #ffd9c7 100%);
    border-color: #ff4500;
    box-shadow: 0 0 20rpx rgba(255, 69, 0, 0.34);
  }
}

.badge-emoji {
  font-size: 42rpx;
  line-height: 1;
}

.badge-name {
  font-size: 21rpx;
  color: #1f2937;
  margin-top: 10rpx;
  font-weight: 600;
  text-align: center;
}

.badge-cond {
  font-size: 18rpx;
  color: #9ca3af;
  margin-top: 2rpx;
  text-align: center;
  line-height: 1.3;
}

// ========== 优势短板 ==========
.advice-row {
  display: flex;
  align-items: flex-start;
  margin-top: 18rpx;
}

.advice-label {
  font-size: 24rpx;
  color: #6b7280;
  width: 110rpx;
  flex-shrink: 0;
  line-height: 40rpx;
}

.advice-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  flex: 1;
}

.advice-tag {
  font-size: 22rpx;
  border-radius: 20rpx;
  padding: 4rpx 18rpx;

  &.strength {
    background: #fff1eb;
    color: #ff4500;
    font-weight: 600;
  }

  &.weakness {
    background: #f1f5f9;
    color: #64748b;
  }
}

.missing-box {
  margin-top: 22rpx;
  background: #fef7f5;
  border: 1rpx solid #fde0d5;
  border-radius: 12rpx;
  padding: 18rpx 20rpx;
}

.missing-title {
  font-size: 23rpx;
  color: #9a3412;
  display: block;
}

// ========== 总述 ==========
.summary-text {
  font-size: 26rpx;
  color: #374151;
  line-height: 1.7;
  margin-top: 14rpx;
  display: block;
}

// ========== 快捷入口四宫格 ==========
.quick-card {
  background: linear-gradient(135deg, #f8fbff 0%, #fff 100%);
  border-color: #dbeafe;
}

.quick-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.quick-item {
  width: 50%;
  display: flex;
  align-items: center;
  padding: 18rpx 8rpx 18rpx 0;
  box-sizing: border-box;
  transition: opacity 0.2s ease;

  &:active {
    opacity: 0.6;
  }
}

.quick-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38rpx;
  flex-shrink: 0;
  margin-right: 16rpx;

  &.icon-report {
    background: linear-gradient(135deg, #fff1eb 0%, #ffd9c7 100%);
  }

  &.icon-match {
    background: linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%);
  }

  &.icon-history {
    background: linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%);
  }

  &.icon-job {
    background: linear-gradient(135deg, #fefce8 0%, #fde68a 100%);
  }
}

.quick-text {
  flex: 1;
  min-width: 0;
}

.quick-label {
  font-size: 25rpx;
  font-weight: 600;
  color: #1f2937;
  display: block;
}

.quick-desc {
  font-size: 19rpx;
  color: #9ca3af;
  margin-top: 4rpx;
  display: block;
}

// ========== 底部 ==========
.page-footer-source {
  text-align: center;
  padding: 20rpx 30rpx 60rpx;
}

.page-footer-source .source-text {
  font-size: 22rpx;
  color: #9ca3af;
  font-style: italic;
  line-height: 1.5;
}
</style>
