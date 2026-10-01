<template>
  <view class="ability-page">
    <!-- 结果区吸顶分段导航：只有生成画像后出现，点击滚动定位 -->
    <view
      v-if="profile && !loading"
      class="anchor-nav"
    >
      <view
        v-for="t in ANCHOR_TABS"
        :key="t.id"
        class="anchor-item"
        :class="{ active: activeAnchor === t.id }"
        @tap="goAnchor(t.id)"
      >
        <text class="anchor-text">{{ t.label }}</text>
      </view>
    </view>

    <scroll-view
      id="ability-scroll"
      scroll-y
      class="page-scroll"
      :style="{ paddingTop: profile && !loading ? '108rpx' : '20rpx' }"
      :scroll-top="scrollTop"
      :scroll-with-animation="true"
      @scroll="onListScroll"
    >
      <!-- ========== 顶部说明 ========== -->
      <view class="intro-card card-style">
        <text class="intro-title">学生就业能力画像</text>
        <text class="intro-desc">
          填写你的专业背景、技能证书、项目与实习经历，系统将从十大维度评估你的就业能力，
          生成能力星球图与职业徽章墙，并给出信息完整度与综合竞争力评分。
        </text>
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
        <view
          id="sec-score"
          class="score-card card-style"
        >
          <view class="score-item">
            <text class="score-num completeness">{{ displayCompleteness }}</text>
            <text class="score-label">信息完整度</text>
            <view class="score-bar">
              <view
                class="score-bar-fill completeness"
                :style="{ width: `${displayCompleteness}%` }"
              />
            </view>
          </view>
          <view class="score-divider" />
          <view class="score-item">
            <text
              class="score-num"
              :style="{ color: levelColor(profile.competitiveness_level) }"
            >
              {{ displayCompetitiveness }}
            </text>
            <text class="score-label">综合就业竞争力</text>
            <view class="score-bar">
              <view
                class="score-bar-fill"
                :style="{
                  width: `${displayCompetitiveness}%`,
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

        <!-- 能力总览：星球图与十维明细合并为一张卡，用分段控件切换（内容一个不少） -->
        <view
          id="sec-ability"
          class="chart-card card-style"
        >
          <view class="card-head">
            <text class="section-title">{{ abilityView === 'planet' ? '能力星球图' : '十大维度明细' }}</text>
            <text class="section-sub">{{ abilityView === 'planet' ? '星球越大越亮 = 该项能力越强' : '点击可查看解析依据' }}</text>
          </view>

          <!-- 分段控件：切换「星球图 / 十维明细」 -->
          <view class="seg">
            <view
              class="seg-item"
              :class="{ active: abilityView === 'planet' }"
              @tap="abilityView = 'planet'"
            >
              <text class="seg-text">星球图</text>
            </view>
            <view
              class="seg-item"
              :class="{ active: abilityView === 'list' }"
              @tap="abilityView = 'list'"
            >
              <text class="seg-text">十维明细</text>
            </view>
          </view>

          <view
            v-if="abilityView === 'planet'"
            class="planet-chart"
          >
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
              <text class="core-score">{{ displayCompetitiveness }}</text>
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

          <!-- 十维明细：与星球图展示同一份数据，切到这一档时渲染 -->
          <block v-else>

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
                    width: `${Math.round(dim.score * animRatio)}%`,
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
          </block>
        </view>

        <!-- 徽章墙 -->
        <view
          id="sec-badge"
          class="badge-card card-style"
        >
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
        <view
          id="sec-conclusion"
          class="advice-card card-style"
        >
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

        <!-- 人岗匹配 / 生涯报告入口（恢复为原有结构） -->
        <view class="match-entry card-style">
          <text class="match-entry-title">接下来做什么？</text>
          <text class="match-entry-desc">
            用你的能力画像与校招岗位逐一比对，输出综合匹配度与十维差距；
            并据此生成含职业路径与分阶段成长计划的生涯发展报告。
          </text>
          <view class="action-row">
            <button
              class="ghost-btn"
              @click="goJobMatch"
            >
              查看岗位匹配
            </button>
            <button
              class="primary-btn"
              @click="goCareerReport"
            >
              生涯发展报告
            </button>
          </view>
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

    <!-- ====================== 隐藏式功能侧边栏 ====================== -->
    <!-- 触发器固定在右侧中部，不占布局；点开后才显示抽屉 -->
    <view
      class="side-trigger"
      :class="{ hidden: drawerOpen }"
      @tap="openDrawer"
    >
      <text class="side-trigger-icon">☰</text>
      <text class="side-trigger-label">功能</text>
    </view>

    <!-- 遮罩：点击关闭 -->
    <view
      v-if="drawerOpen"
      class="drawer-mask"
      @tap="closeDrawer"
    ></view>

    <!-- 抽屉本体：始终在 DOM 里，靠 transform 做滑入动画 -->
    <view
      class="drawer"
      :class="{ open: drawerOpen }"
    >
      <view class="drawer-head">
        <view class="drawer-head-texts">
          <text class="drawer-title">功能总览</text>
          <text class="drawer-sub">本小程序的全部功能入口</text>
        </view>
        <text
          class="drawer-close"
          @tap="closeDrawer"
        >
          ✕
        </text>
      </view>

      <scroll-view
        class="drawer-body"
        scroll-y
      >
        <view
          v-for="group in FEATURE_NAV_GROUPS"
          :key="group.title"
          class="drawer-group"
        >
          <text class="drawer-group-title">{{ group.title }}</text>

          <view
            v-for="item in group.items"
            :key="item.key"
            class="drawer-item"
            :class="{ current: item.key === CURRENT_FEATURE_KEY }"
            @tap="openFeature(item)"
          >
            <text class="drawer-item-icon">{{ item.icon }}</text>
            <view class="drawer-item-texts">
              <text class="drawer-item-name">{{ item.name }}</text>
              <text class="drawer-item-desc">{{ item.desc }}</text>
            </view>
            <text class="drawer-item-arrow">
              {{ item.key === CURRENT_FEATURE_KEY ? '当前' : '›' }}
            </text>
          </view>
        </view>

        <view class="drawer-foot">
          <text class="drawer-foot-text">
            能力画像的数据保存在本机，不需要登录即可使用与演示。
          </text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
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
import {
  CURRENT_FEATURE_KEY,
  FEATURE_NAV_GROUPS,
  openFeatureNav,
  type FeatureNavItem,
} from '@/utils/featureNav';

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

// ====================== 能力卡片视图切换 ======================

/**
 * 能力卡片当前展示哪一档。
 * 星球图与十维明细合并成一张卡后用分段控件切换；
 * 两档共用同一份 profile.dimensions，只是一个画成图、一个列成表。
 */
const abilityView = ref<'planet' | 'list'>('planet')

// ====================== 结果区锚点导航（吸顶） ======================

/** 结果区分段导航项：id 与模板里各卡片的 id 一一对应 */
const ANCHOR_TABS = [
  { id: 'sec-score', label: '评分' },
  { id: 'sec-ability', label: '能力' },
  { id: 'sec-badge', label: '徽章' },
  { id: 'sec-conclusion', label: '结论' },
]

/** 当前高亮的导航项 */
const activeAnchor = ref('sec-score')

/**
 * 滚动位置绑定值。
 * 页面主体在 <scroll-view> 内部滚动（.page-scroll 高 100vh），
 * 所以页面级的 uni.pageScrollTo 对它无效，必须用 scroll-top 定位。
 */
const scrollTop = ref(0)

/** 由 @scroll 记录的真实滚动位置（不参与绑定，避免回写引起抖动） */
let currentScrollTop = 0

const onListScroll = (e: { detail?: { scrollTop?: number } }) => {
  currentScrollTop = e?.detail?.scrollTop ?? 0
}

/** 吸顶导航高度（px）：88rpx 按屏宽换算，跳转时用它避开遮挡 */
const navHeightPx = (): number => {
  try {
    const win = (uni.getWindowInfo?.() ?? uni.getSystemInfoSync?.() ?? {}) as {
      windowWidth?: number
    }
    return ((win.windowWidth ?? 375) * 88) / 750
  } catch {
    return 44
  }
}

/** 点击导航项：滚动到对应卡片并高亮 */
const goAnchor = (id: string) => {
  activeAnchor.value = id

  // 取不到选择器 API 时静默跳过——只是不能跳转，不影响任何内容的展示
  const query = (uni as unknown as { createSelectorQuery?: () => unknown }).createSelectorQuery
  if (typeof query !== 'function') return

  try {
    const q = uni.createSelectorQuery()
    q.select(`#${id}`).boundingClientRect()
    q.select('#ability-scroll').boundingClientRect()
    q.select('#ability-scroll').scrollOffset()
    q.exec((res: unknown[]) => {
      const target = res[0] as { top?: number } | null
      const box = res[1] as { top?: number } | null
      const offset = res[2] as { scrollTop?: number } | null
      if (target?.top === undefined || box?.top === undefined || offset?.scrollTop === undefined) {
        return
      }
      const delta = target.top - box.top
      scrollTop.value = Math.max(0, Math.round(currentScrollTop + delta - navHeightPx()))
    })
  } catch {
    // 定位失败不影响内容
  }
}

// ====================== 入场动画 ======================

/**
 * 入场动画进度 0 → 1。
 *
 * 所有数字与进度条都由它算出来，而不是各自维护一份状态——
 * 默认值取 1、收尾强制为 1，所以即使动画没跑起来，显示的也是精确值。
 */
const animRatio = ref(1)

const displayCompleteness = computed(() =>
  Math.round((profile.value?.completeness ?? 0) * animRatio.value)
)
const displayCompetitiveness = computed(() =>
  Math.round((profile.value?.competitiveness ?? 0) * animRatio.value)
)

let animTimer: ReturnType<typeof setInterval> | null = null

const stopScoreAnimation = () => {
  if (animTimer !== null) {
    clearInterval(animTimer)
    animTimer = null
  }
}

/** 数字滚动 + 进度条生长：24 步、约 600ms、easeOutCubic 收尾 */
const runScoreAnimation = () => {
  stopScoreAnimation()
  animRatio.value = 0
  const STEPS = 24
  const INTERVAL = 25
  let step = 0
  animTimer = setInterval(() => {
    step += 1
    const ratio = Math.min(1, step / STEPS)
    animRatio.value = 1 - Math.pow(1 - ratio, 3)
    if (ratio >= 1) {
      animRatio.value = 1
      stopScoreAnimation()
    }
  }, INTERVAL)
}

// 画像一变就播一次（生成、读缓存、重新解析三种入口都覆盖）
watch(
  () => profile.value,
  (p) => {
    if (p) {
      activeAnchor.value = 'sec-score'
      currentScrollTop = 0
      scrollTop.value = 0
      runScoreAnimation()
    } else {
      stopScoreAnimation()
      animRatio.value = 1
    }
  },
  { immediate: true }
)

let inFlight = false;
let unloaded = false;

onUnload(() => {
  unloaded = true;
  // 离开页面时清掉动画定时器，避免后台空转
  stopScoreAnimation();
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



/** 跳转到人岗匹配页（复用本地已保存的画像，离线可用） */
const goJobMatch = () => {
  uni.navigateTo({ url: '/pagesMember/jobMatch/jobMatch' });
};

/** 跳转到生涯发展报告页 */
const goCareerReport = () => {
  uni.navigateTo({ url: '/pagesMember/careerReport/careerReport' });
};

// ====================== 功能侧边栏 ======================

const drawerOpen = ref(false);

const openDrawer = () => {
  drawerOpen.value = true;
};

const closeDrawer = () => {
  drawerOpen.value = false;
};

/**
 * 打开侧边栏里的某个功能。
 *
 * 点「当前所在功能」只关抽屉、不再跳转：
 * tabBar 页面 switchTab 到自己会闪一下，体验很差。
 */
const openFeature = (item: FeatureNavItem) => {
  closeDrawer();
  if (item.key === CURRENT_FEATURE_KEY) return;
  openFeatureNav(item);
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

// ========== 人岗匹配入口（原有结构，已恢复） ==========
.match-entry {
  background: linear-gradient(135deg, #f0fdf4 0%, #fff 100%);
  border-color: #bbf7d0;
}

.match-entry-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #15803d;
  display: block;
}

.match-entry-desc {
  font-size: 23rpx;
  color: #6b7280;
  line-height: 1.6;
  margin: 10rpx 0 20rpx;
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

/* ====================== 功能侧边栏 ====================== */

/* 触发器：贴右侧边缘、垂直中部，不占文档流 */
.side-trigger {
  position: fixed;
  right: 0;
  top: 46%;
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20rpx 14rpx;
  background: rgba(255, 69, 0, 0.92);
  border-radius: 20rpx 0 0 20rpx;
  box-shadow: -4rpx 4rpx 18rpx rgba(255, 69, 0, 0.28);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;

  &.hidden {
    opacity: 0;
    transform: translateX(110%);
    pointer-events: none;
  }
}

.side-trigger-icon {
  font-size: 30rpx;
  color: #ffffff;
  line-height: 1.1;
}

.side-trigger-label {
  font-size: 22rpx;
  color: #ffffff;
  margin-top: 6rpx;
}

/* 遮罩 */
.drawer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
}

/* 抽屉本体：常驻 DOM，靠 transform 滑入滑出 */
.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 80%;
  max-width: 620rpx;
  background: #ffffff;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  border-radius: 0 28rpx 28rpx 0;
  box-shadow: 8rpx 0 32rpx rgba(0, 0, 0, 0.16);
  transform: translateX(-104%);
  transition: transform 0.28s cubic-bezier(0.25, 0.8, 0.25, 1);

  &.open {
    transform: translateX(0);
  }
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 36rpx 28rpx 24rpx;
  background: linear-gradient(135deg, #ff7a4d 0%, #ff4500 100%);
  border-radius: 0 28rpx 0 0;
}

.drawer-head-texts {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.drawer-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8rpx;
}

.drawer-sub {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
}

.drawer-close {
  font-size: 30rpx;
  color: #ffffff;
  padding: 4rpx 8rpx;
  line-height: 1;
}

.drawer-body {
  flex: 1;
  padding: 20rpx 20rpx 40rpx;
  box-sizing: border-box;
}

.drawer-group {
  margin-bottom: 24rpx;
}

.drawer-group-title {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: #9ca3af;
  letter-spacing: 2rpx;
  padding: 0 8rpx 12rpx;
}

.drawer-item {
  display: flex;
  align-items: center;
  padding: 20rpx 16rpx;
  border-radius: 16rpx;
  margin-bottom: 8rpx;
  background: #fafbfc;
  transition: background-color 0.2s ease;

  &.current {
    background: #fff3ef;
    border: 2rpx solid #ff9a7a;
  }

  &:active {
    background: #f1f5f9;
  }
}

.drawer-item-icon {
  font-size: 34rpx;
  margin-right: 18rpx;
}

.drawer-item-texts {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.drawer-item-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4rpx;

  .drawer-item.current & {
    color: #ff4500;
  }
}

.drawer-item-desc {
  font-size: 21rpx;
  color: #9ca3af;
  line-height: 1.5;
}

.drawer-item-arrow {
  font-size: 24rpx;
  color: #d1d5db;
  margin-left: 12rpx;
  flex-shrink: 0;

  .drawer-item.current & {
    color: #ff4500;
    font-size: 20rpx;
  }
}

.drawer-foot {
  padding: 20rpx 16rpx 10rpx;
  border-top: 1rpx solid #f1f5f9;
  margin-top: 8rpx;
}

.drawer-foot-text {
  font-size: 21rpx;
  color: #9ca3af;
  line-height: 1.7;
}

// ========== 分段控件（星球图 / 十维明细切换） ==========
.seg {
  display: flex;
  align-items: center;
  background: #f1f5f9;
  border-radius: 12rpx;
  padding: 6rpx;
  margin: 18rpx 0 8rpx;
}

.seg-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60rpx;
  border-radius: 9rpx;
  transition: background-color 0.2s ease;

  &.active {
    background: #ffffff;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);

    .seg-text {
      color: #ff4500;
      font-weight: 600;
    }
  }
}

.seg-text {
  font-size: 26rpx;
  color: #6b7280;
}

// ========== 结果区吸顶分段导航 ==========
.anchor-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 12rpx;
  box-sizing: border-box;
  background: #ffffff;
  border-bottom: 1rpx solid #e5e7eb;
}

.anchor-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60rpx;
  border-radius: 30rpx;
  transition: background-color 0.2s ease;

  &.active {
    background: #fff1ec;

    .anchor-text {
      color: #ff4500;
      font-weight: 600;
    }
  }
}

.anchor-text {
  font-size: 26rpx;
  color: #6b7280;
}
</style>
