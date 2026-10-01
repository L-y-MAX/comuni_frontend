<template>
  <view class="job-profile-page">
    <!-- ========== 加载中 ========== -->
    <view
      v-if="loading"
      class="state-panel"
    >
      <view class="state-card">
        <view class="spinner" />
        <text class="state-title">正在生成岗位画像</text>
        <text class="state-desc">{{ progressText || '正在读取岗位数据…' }}</text>
        <text class="state-tip">首次生成需解析岗位文本，请稍候</text>
      </view>
    </view>

    <!-- ========== 加载失败 ========== -->
    <view
      v-else-if="errorMsg"
      class="state-panel"
    >
      <view class="state-card">
        <text class="state-title">生成失败</text>
        <text class="state-desc">{{ errorMsg }}</text>
        <button
          class="primary-btn"
          @click="loadAll"
        >
          重新加载
        </button>
      </view>
    </view>

    <!-- ========== 未指定岗位：先在页内选一个岗位 ========== -->
    <scroll-view
      v-else-if="pickerMode"
      scroll-y
      class="profile-scroll"
    >
      <view class="header-card card-style">
        <text class="job-name">岗位能力画像</text>
        <text class="enterprise-name">选定一个岗位，查看它在十个能力维度上的要求</text>
      </view>

      <view class="card-style">
        <text class="pick-title">可查看的岗位</text>
        <text class="pick-desc">
          登录后这里会列出校招合作企业的真实岗位；未登录也可以用下面的内置示例岗位体验完整画像，
          两者使用同一套解析逻辑。
        </text>
        <text
          v-if="pickerLoading"
          class="pick-loading"
        >
          正在加载校招岗位…
        </text>

        <!-- 搜索：按岗位名称 / 企业 / 行业过滤候选项 -->
        <view class="pick-search">
          <text class="pick-search-icon">🔍</text>
          <input
            v-model="pickerKeyword"
            class="pick-search-input"
            type="text"
            placeholder="搜索岗位名称、企业或行业"
            placeholder-class="pick-search-ph"
            confirm-type="search"
          />
          <view
            v-if="pickerKeyword"
            class="pick-search-clear"
            @tap="pickerKeyword = ''"
          >
            <text class="pick-search-clear-icon">✕</text>
          </view>
        </view>

        <text
          v-if="pickerKeyword"
          class="pick-hit"
        >
          命中 {{ filteredPickerItems.length }} / {{ pickerItems.length }} 个岗位
        </text>

        <!-- 空状态 -->
        <view
          v-if="pickerKeyword && !filteredPickerItems.length"
          class="pick-empty"
        >
          <text class="pick-empty-title">没有匹配的岗位</text>
          <text class="pick-empty-desc">
            换个关键词，或点搜索框右侧的 ✕ 清空后查看全部 {{ pickerItems.length }} 个岗位。
          </text>
        </view>

        <view
          v-for="item in filteredPickerItems"
          :key="item.key"
          class="pick-item"
          @tap="chooseJob(item)"
        >
          <view class="pick-item-main">
            <text class="pick-item-name">{{ item.jobName }}</text>
            <text class="pick-item-meta">{{ item.enterpriseName }}<text v-if="item.industry"> · {{ item.industry }}</text></text>
          </view>
          <text
            class="pick-item-badge"
            :class="item.source"
          >
            {{ item.source === 'real' ? '校招' : '示例' }}
          </text>
        </view>
      </view>

      <view class="page-footer-source">
        <text class="source-text">示例岗位仅用于离线演示，来源会在画像页如实标注</text>
      </view>
    </scroll-view>

    <!-- ========== 画像内容 ========== -->
    <!-- 必须显式判断 profile 存在：模板下方大量 `profile.xxx` 取值，
         若 profile 为 null 会在渲染期抛 TypeError 导致白屏 -->
    <scroll-view
      v-else-if="profile"
      scroll-y
      class="profile-scroll"
    >
      <!-- 岗位抬头 -->
      <view class="header-card card-style">
        <text class="job-name">{{ profile.job_name }}</text>
        <text class="enterprise-name">{{ profile.enterprise_name || '未知企业' }}</text>
        <view class="header-meta">
          <text
            v-if="profile.industry"
            class="meta-tag"
          >
            {{ profile.industry }}
          </text>
          <text
            v-if="profile.salary_range"
            class="meta-tag salary"
          >
            {{ profile.salary_range }}
          </text>
          <text
            v-if="profile.recruit_number"
            class="meta-tag"
          >
            招 {{ profile.recruit_number }} 人
          </text>
        </view>
        <view
          v-if="profile.recruit_major.length"
          class="major-row"
        >
          <text class="major-label">招聘专业：</text>
          <text class="major-value">{{ profile.recruit_major.join('、') }}</text>
        </view>
      </view>

      <!-- 解析来源声明 -->
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
          仅覆盖文本中明确出现的要求，建议后端接口就绪后重新解析。
        </text>
        <text
          v-else
          class="source-note"
        >
          本画像由阿里千问大模型对岗位文本结构化解析生成，十大维度分值可直接用于人岗匹配计算。
        </text>
      </view>

      <!-- 画像总述 -->
      <view
        v-if="profile.summary"
        class="summary-card card-style"
      >
        <text class="section-title">画像总述</text>
        <text class="summary-text">{{ profile.summary }}</text>
        <view
          v-if="focusDimensions.length"
          class="focus-row"
        >
          <text class="focus-label">能力侧重</text>
          <view class="focus-tags">
            <text
              v-for="f in focusDimensions"
              :key="f.key"
              class="focus-tag"
            >
              {{ f.label }}
            </text>
          </view>
        </view>
      </view>

      <!-- 十大维度 -->
      <view class="dim-section card-style">
        <view class="dim-section-head">
          <text class="section-title">岗位能力画像（十大维度）</text>
          <text class="section-sub">点击维度可查看解析依据</text>
        </view>

        <view
          v-for="dim in profile.dimensions"
          :key="dim.key"
          class="dim-item"
          @click="toggleDim(dim.key)"
        >
          <!-- 维度标题行 -->
          <view class="dim-head">
            <view class="dim-title-wrap">
              <text class="dim-label">{{ dim.label }}</text>
              <text class="dim-weight">权重 {{ weightPercent(dim.weight) }}%</text>
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

          <!-- 分值条 -->
          <view class="bar-track">
            <view
              class="bar-fill"
              :style="{
                width: `${dim.score}%`,
                backgroundColor: levelColor(dim.level),
              }"
            />
          </view>

          <!-- 专业技能：技能清单 -->
          <view
            v-if="dim.key === 'professional_skill' && dim.skills && dim.skills.length"
            class="chip-group"
          >
            <text
              v-for="(s, i) in dim.skills"
              :key="`${s.name}-${i}`"
              class="chip"
              :class="s.requirement"
            >
              {{ s.name }}{{ s.requirement === 'must' ? ' ·必须' : '' }}
            </text>
          </view>

          <!-- 证书要求：证书清单 -->
          <view
            v-if="dim.key === 'certificate'"
            class="chip-group"
          >
            <text
              v-if="!dim.certificates || !dim.certificates.length"
              class="empty-note"
            >
              未识别到明确的证书要求
            </text>
            <text
              v-for="(c, i) in dim.certificates || []"
              :key="`${c.name}-${i}`"
              class="chip"
              :class="c.requirement"
            >
              {{ c.name }}{{ c.requirement === 'must' ? ' ·必须' : '' }}
            </text>
          </view>

          <!-- 展开：解析依据 -->
          <view
            v-if="expandedKey === dim.key"
            class="evidence-box"
          >
            <text class="evidence-title">
              解析依据（置信度 {{ Math.round(dim.confidence * 100) }}%）
            </text>
            <text
              v-if="!dim.evidence.length"
              class="empty-note"
            >
              现有岗位文本中未出现该维度的明确表述，分值为默认基准值，
              建议补充岗位职责说明后重新解析。
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

      <!-- 垂直晋升路径（为岗位图谱预留） -->
      <view
        v-if="profile.promotion_path.length"
        class="promotion-card card-style"
      >
        <text class="section-title">垂直晋升路径</text>
        <view class="promotion-chain">
          <view
            v-for="(step, i) in profile.promotion_path"
            :key="i"
            class="promotion-step"
          >
            <text class="promotion-node">{{ step }}</text>
            <text
              v-if="i < profile.promotion_path.length - 1"
              class="promotion-arrow"
            >
              ↓
            </text>
          </view>
        </view>
        <text class="promotion-note">
          该路径为岗位垂直晋升主链，跨岗换路图谱待「岗位图谱」模块上线后补充。
        </text>
      </view>

      <!-- 人岗匹配入口 -->
      <view class="match-entry card-style">
        <text class="match-entry-title">我和这个岗位匹配吗？</text>
        <text class="match-entry-desc">
          用你的能力画像与该岗位逐一比对十项能力要求，输出综合匹配度、差距明细与提升建议。
        </text>
        <button
          class="primary-btn"
          @click="goJobMatch"
        >
          查看匹配度分析
        </button>
      </view>

      <!-- 操作区：示例岗位没有 credit_code，无法按岗位重新拉取，因此不显示重解析按钮 -->
      <view
        v-if="currentCreditCode"
        class="action-row"
      >
        <button
          class="primary-btn"
          @click="regenerate"
        >
          重新解析
        </button>
        <button
          class="ghost-btn"
          @click="forceLocalParse"
        >
          本地规则解析
        </button>
      </view>

      <view class="page-footer-source">
        <text class="source-text">
          岗位数据由齐鲁人才网&聊城大学毕业生就业指导中心提供支持
        </text>
      </view>
    </scroll-view>

    <!-- ========== 兜底分支：不应出现，但避免任何情况下白屏 ========== -->
    <view
      v-else
      class="state-panel"
    >
      <view class="state-card">
        <text class="state-title">暂无画像数据</text>
        <text class="state-desc">未能加载岗位画像，请返回重试</text>
        <button
          class="primary-btn"
          @click="loadAll"
        >
          重新加载
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onUnload, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import {
  LEVEL_LABEL,
  PARSE_SOURCE_LABEL,
  type AbilityLevel,
  type JobDimensionKey,
  type JobProfile,
} from '@/types/jobProfile';
import {
  fetchRecruitmentByCreditCode,
  fetchRecruitmentList,
  generateJobProfile,
  type RecruitmentRecord,
} from '@/api/jobProfile';
import { SAMPLE_RECRUITMENTS } from '@/utils/jobProfileSamples';
import { parseJobProfileByRules } from '@/utils/jobProfileParser';

// 招聘原始记录的类型与读取函数统一由 @/api/jobProfile 提供
// （RecruitmentRecord / fetchRecruitmentByCreditCode），此处不再重复定义。

// ====================== 页面状态 ======================

const loading = ref(true);
const errorMsg = ref('');
const progressText = ref('');
const degradedReason = ref('');

const profile = ref<JobProfile | null>(null);
const currentCreditCode = ref('');
const expandedKey = ref<JobDimensionKey | null>(null);

/** 是否有一次生成流程正在进行中（防止重复点击并发发起请求） */
let inFlight = false;
/** 页面是否已卸载（用于中止千问轮询，避免离开后仍在发请求） */
let unloaded = false;

onUnload(() => {
  unloaded = true;
});

// ====================== 计算属性 ======================

const isDegraded = computed(() => !!degradedReason.value);

const sourceLabel = computed(() =>
  profile.value ? PARSE_SOURCE_LABEL[profile.value.parse_method] : ''
);

const confidencePercent = computed(() =>
  profile.value ? Math.round(profile.value.confidence * 100) : 0
);

const focusDimensions = computed(() => {
  if (!profile.value) return [];
  return profile.value.dimensions.filter((d) =>
    profile.value!.focus_dimensions.includes(d.key)
  );
});

// ====================== 展示辅助 ======================

const levelLabel = (level: AbilityLevel): string => LEVEL_LABEL[level] ?? '中';

/** 等级配色：要求越高越突出，要求低用中性灰而非绿色（避免误读为「好消息」） */
const levelColor = (level: AbilityLevel): string => {
  if (level === 'high') return '#ff4500';
  if (level === 'medium') return '#f59e0b';
  return '#94a3b8';
};

const weightPercent = (weight: number): string => (weight * 100).toFixed(0);

const toggleDim = (key: JobDimensionKey) => {
  expandedKey.value = expandedKey.value === key ? null : key;
};

// ====================== 数据加载 ======================

// ====================== 岗位选择（未带岗位参数进入时） ======================

/** 岗位候选项 */
interface PickJobItem {
  key: string;
  jobName: string;
  enterpriseName: string;
  industry: string;
  /** real = 校招真实岗位（需登录）；sample = 内置示例岗位（离线可用） */
  source: 'real' | 'sample';
  creditCode?: string;
  sampleIndex?: number;
}

const pickerMode = ref(false);
const pickerItems = ref<PickJobItem[]>([]);
const pickerLoading = ref(false);

/**
 * 岗位搜索关键词。
 * 只过滤「候选岗位列表」，不影响真实岗位 / 示例岗位的解析流程。
 */
const pickerKeyword = ref('');

/** 过滤后的候选岗位；关键词为空时返回全部 */
const filteredPickerItems = computed<PickJobItem[]>(() => {
  const kw = pickerKeyword.value.trim().toLowerCase();
  if (!kw) return pickerItems.value;
  return pickerItems.value.filter((it) =>
    [it.jobName, it.enterpriseName, it.industry].join(' ').toLowerCase().includes(kw)
  );
});

/** 内置示例岗位：交出原始招聘输入，由同一套解析逻辑生成画像 */
const buildSamplePicker = (): PickJobItem[] =>
  SAMPLE_RECRUITMENTS.map((r, i) => ({
    key: `sample-${i}`,
    jobName: r.job_name ?? '未知岗位',
    enterpriseName: r.enterprise_name ?? '',
    industry: r.industry ?? '',
    source: 'sample' as const,
    sampleIndex: i,
  }));

/**
 * 载入岗位候选。
 *
 * 顺序：真实校招岗位在前（同名时优先保留真实岗位），内置示例岗位补在后面。
 * 示例岗位始终存在，保证未登录、无网络时这一页也可用——否则「岗位能力画像」
 * 这个入口在未登录状态下等于死路。
 */
const loadPicker = async () => {
  pickerLoading.value = true;
  const samples = buildSamplePicker();
  pickerItems.value = samples;
  try {
    const real = await fetchRecruitmentList();
    const realItems: PickJobItem[] = real
      .filter((r) => r.credit_code && r.job_name)
      .map((r) => ({
        key: `real-${r.credit_code}`,
        jobName: r.job_name,
        enterpriseName: r.enterprise_name ?? '',
        industry: r.industry ?? '',
        source: 'real' as const,
        creditCode: r.credit_code,
      }));
    const realNames = new Set(realItems.map((i) => i.jobName));
    pickerItems.value = [...realItems, ...samples.filter((s) => !realNames.has(s.jobName))];
  } catch {
    // 拉不到真实岗位不是错误：内置示例足够演示
    pickerItems.value = samples;
  } finally {
    pickerLoading.value = false;
  }
};

/** 选中岗位：真实岗位走原有流程，示例岗位直接用本地规则解析 */
const chooseJob = async (item: PickJobItem) => {
  if (item.source === 'real' && item.creditCode) {
    pickerMode.value = false;
    currentCreditCode.value = item.creditCode;
    await loadAll();
    return;
  }

  if (item.sampleIndex === undefined) return;
  const raw = SAMPLE_RECRUITMENTS[item.sampleIndex];
  if (!raw) return;

  pickerMode.value = false;
  expandedKey.value = null;
  // 如实标注这是内置示例 + 本地规则解析，不伪装成真实岗位或大模型结果
  degradedReason.value =
    '当前展示的是内置示例岗位，由本地关键词规则解析生成；登录后可从校招招聘信息中解析真实岗位文本。';
  profile.value = parseJobProfileByRules(raw);
  uni.pageScrollTo({ scrollTop: 0, duration: 200 });
};

onLoad((options) => {
  const creditCode = options?.id;
  if (!creditCode) {
    // 未带岗位参数进入（例如从侧边栏或「我的」直接点「岗位能力画像」）：
    // 不报参数错误，改为进入岗位选择模式，由用户在本页内选岗位。
    loading.value = false;
    pickerMode.value = true;
    void loadPicker();
    return;
  }
  currentCreditCode.value = creditCode;
  loadAll();
});

/** 拉取招聘原始数据：复用 api/jobProfile 的共享实现，避免三个页面各写一份 */
const fetchRecruitment = (creditCode: string): Promise<RecruitmentRecord> =>
  fetchRecruitmentByCreditCode(creditCode);

/** 主流程：拉数据 → 生成画像 */
/**
 * 统一的「拉数据 + 生成画像」流程
 *
 * 三种入口（首次加载 / 重新解析 / 强制本地）只差参数，因此共用一份实现，
 * 避免逻辑分叉导致某条路径漏重置状态（初版三份拷贝就出现了 expandedKey 未重置的差异）。
 */
const runGenerate = async (
  opts: { useCache?: boolean; forceLocal?: boolean; toast?: string } = {}
) => {
  if (!currentCreditCode.value) return;
  // 已在进行中则忽略重复触发，避免两次流程互相覆盖结果
  if (inFlight) return;
  inFlight = true;

  loading.value = true;
  errorMsg.value = '';
  degradedReason.value = '';
  expandedKey.value = null;

  try {
    progressText.value = '正在读取岗位数据…';
    const r = await fetchRecruitment(currentCreditCode.value);

    const result = await generateJobProfile(
      {
        recruitment_id: r.credit_code,
        job_name: r.job_name,
        enterprise_name: r.enterprise_name,
        industry: r.industry,
        recruit_major: r.recruit_major,
        monthly_salary: r.monthly_salary,
        recruit_number: r.recruit_number,
        enterprise_intro: r.enterprise_intro,
      },
      {
        // 传 undefined 时会走 generateJobProfile 内部的默认值（useCache 默认 true）
        useCache: opts.useCache,
        forceLocal: opts.forceLocal,
        // 离开页面后停止轮询
        shouldStop: () => unloaded,
        onProgress: (msg) => {
          progressText.value = msg;
        },
      }
    );

    profile.value = result.profile;
    degradedReason.value = result.degraded ? result.degradedReason || '接口未就绪' : '';

    if (opts.toast) {
      uni.showToast({ title: opts.toast, icon: 'success', duration: 1500 });
    }
  } catch (err) {
    // 用户已离开页面导致的取消：不提示错误、不改状态
    if (err instanceof Error && err.name === 'AbortError') {
      return;
    }
    errorMsg.value = err instanceof Error ? err.message : '生成岗位画像失败';
  } finally {
    inFlight = false;
    loading.value = false;
    progressText.value = '';
  }
};

/** 首次加载：允许命中后端缓存 */
const loadAll = () => runGenerate();

/** 重新解析：跳过后端缓存，重新走千问 */
const regenerate = () => runGenerate({ useCache: false, toast: '已重新生成' });

/** 强制本地规则解析：调试/降级演示用，不发千问请求 */
const forceLocalParse = () => runGenerate({ forceLocal: true, toast: '已切换本地规则解析' });

/** 跳转到人岗匹配页，带上当前岗位标识 */
const goJobMatch = () => {
  if (!currentCreditCode.value) {
    uni.showToast({ title: '岗位信息未就绪', icon: 'none', duration: 2000 });
    return;
  }
  uni.navigateTo({
    url: `/pagesMember/jobMatch/jobMatch?id=${encodeURIComponent(currentCreditCode.value)}`,
    fail: (err) => {
      console.error('跳转人岗匹配页失败：', err);
      uni.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 });
    },
  });
};

// ====================== 分享 ======================

onShareAppMessage(() => ({
  title: profile.value
    ? `${profile.value.job_name}岗位能力画像`
    : '岗位能力画像',
  path: `/pagesMember/recruitment/job-profile?id=${currentCreditCode.value}`,
  imageUrl: 'https://youupro.xyz/notes/static/icons/recruit-detail-share.png',
}));

onShareTimeline(() => ({
  title: profile.value
    ? `${profile.value.job_name}需要什么能力？来看岗位画像`
    : '岗位能力画像',
  path: `/pagesMember/recruitment/job-profile?id=${currentCreditCode.value}`,
}));
</script>

<style scoped lang="scss">
.job-profile-page {
  min-height: 100vh;
  background: #f8fafc;
  -webkit-tap-highlight-color: transparent;
  padding: 0 20rpx;
}

// ========== 状态面板（加载 / 失败） ==========
.state-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 0 20rpx;
}

.state-card {
  width: 100%;
  background: #fff;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  padding: 60rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.state-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
}

.state-desc {
  font-size: 26rpx;
  color: #6b7280;
  text-align: center;
  line-height: 1.6;
}

.state-tip {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 20rpx;
}

.spinner {
  width: 56rpx;
  height: 56rpx;
  border: 5rpx solid #ffe0d3;
  border-top-color: #ff4500;
  border-radius: 50%;
  margin-bottom: 28rpx;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// ========== 滚动区 ==========
.profile-scroll {
  height: 100vh;
  padding: 20rpx 0 40rpx;
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

// ========== 抬头 ==========
.header-card {
  display: flex;
  flex-direction: column;
}

.job-name {
  font-size: 38rpx;
  font-weight: 700;
  color: #1f2937;
}

.enterprise-name {
  font-size: 26rpx;
  color: #6b7280;
  margin-top: 8rpx;
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.meta-tag {
  font-size: 22rpx;
  color: #6b7280;
  background: #f1f5f9;
  border-radius: 8rpx;
  padding: 4rpx 14rpx;
}

.meta-tag.salary {
  color: #ff4500;
  background: #fff1eb;
  font-weight: 600;
}

.major-row {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}

.major-label {
  font-size: 24rpx;
  color: #6b7280;
}

.major-value {
  font-size: 24rpx;
  color: #1f2937;
  flex: 1;
}

// ========== 解析来源 ==========
.source-card {
  background: #f0f9ff;
  border-color: #bae6fd;
}

.source-card.degraded {
  background: #fffbeb;
  border-color: #fde68a;
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
}

// ========== 总述 ==========
.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
}

.section-sub {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 6rpx;
}

.summary-text {
  font-size: 26rpx;
  color: #374151;
  line-height: 1.7;
  margin-top: 14rpx;
  display: block;
}

.focus-row {
  margin-top: 20rpx;
  display: flex;
  align-items: flex-start;
}

.focus-label {
  font-size: 24rpx;
  color: #6b7280;
  width: 130rpx;
  flex-shrink: 0;
}

.focus-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  flex: 1;
}

.focus-tag {
  font-size: 22rpx;
  color: #fff;
  background: #ff4500;
  border-radius: 20rpx;
  padding: 4rpx 18rpx;
}

// ========== 维度列表 ==========
.dim-section-head {
  margin-bottom: 8rpx;
}

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
  align-items: baseline;
}

.dim-label {
  font-size: 28rpx;
  color: #1f2937;
  font-weight: 600;
}

.dim-weight {
  font-size: 20rpx;
  color: #9ca3af;
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

// ========== 标签 chips ==========
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

  &.must {
    background: #fff1eb;
    color: #ff4500;
    font-weight: 600;
  }
}

.empty-note {
  font-size: 22rpx;
  color: #9ca3af;
  line-height: 1.6;
  display: block;
}

// ========== 证据 ==========
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

// ========== 晋升路径 ==========
.promotion-chain {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20rpx;
}

.promotion-step {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.promotion-node {
  font-size: 24rpx;
  color: #1f2937;
  background: #fff1eb;
  border: 1rpx solid #ffd0bb;
  border-radius: 10rpx;
  padding: 8rpx 24rpx;
}

.promotion-arrow {
  font-size: 24rpx;
  color: #ff4500;
  line-height: 1.4;
}

.promotion-note {
  font-size: 22rpx;
  color: #9ca3af;
  line-height: 1.6;
  margin-top: 18rpx;
  display: block;
}

// ========== 人岗匹配入口 ==========
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

// ========== 操作区 ==========
.action-row {
  display: flex;
  gap: 20rpx;
  margin-top: 10rpx;
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
}

.ghost-btn {
  background: #fff;
  color: #ff4500;
  border: 2rpx solid #ff4500;
}

// ========== 底部数据源 ==========
.page-footer-source {
  text-align: center;
  padding: 30rpx 30rpx 40rpx;
}

.page-footer-source .source-text {
  font-size: 24rpx;
  color: #9ca3af;
  font-style: italic;
  line-height: 1.5;
}

/* ====================== 岗位选择（未指定岗位时） ====================== */
.pick-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 12rpx;
}

.pick-desc {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.7;
  margin-bottom: 20rpx;
}

.pick-loading {
  display: block;
  font-size: 23rpx;
  color: #ff4500;
  margin-bottom: 16rpx;
}

.pick-item {
  display: flex;
  align-items: center;
  padding: 24rpx 20rpx;
  background: #fafbfc;
  border-radius: 16rpx;
  margin-bottom: 12rpx;
  transition: background-color 0.2s ease;

  &:active {
    background: #f1f5f9;
  }
}

.pick-item-main {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.pick-item-name {
  font-size: 29rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 6rpx;
}

.pick-item-meta {
  font-size: 22rpx;
  color: #9ca3af;
}

.pick-item-badge {
  font-size: 20rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  margin-left: 12rpx;

  &.real {
    background: #dbeafe;
    color: #1d4ed8;
  }

  &.sample {
    background: #fef3c7;
    color: #b45309;
  }
}

/* ====================== 选岗搜索 ====================== */
.pick-search {
  display: flex;
  align-items: center;
  height: 76rpx;
  padding: 0 22rpx;
  margin: 4rpx 0 16rpx;
  background: #f7f8fa;
  border: 1rpx solid #e5e7eb;
  border-radius: 38rpx;
  box-sizing: border-box;
}

.pick-search-icon {
  font-size: 26rpx;
  margin-right: 12rpx;
}

.pick-search-input {
  flex: 1;
  font-size: 27rpx;
  color: #1f2937;
}

.pick-search-ph {
  color: #9ca3af;
  font-size: 25rpx;
}

.pick-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  background: #e5e7eb;
  margin-left: 12rpx;

  &:active {
    background: #d1d5db;
  }
}

.pick-search-clear-icon {
  font-size: 20rpx;
  color: #6b7280;
  line-height: 1;
}

.pick-hit {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-bottom: 14rpx;
}

.pick-empty {
  padding: 48rpx 20rpx;
  text-align: center;
}

.pick-empty-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 10rpx;
}

.pick-empty-desc {
  display: block;
  font-size: 23rpx;
  color: #9ca3af;
  line-height: 1.7;
}
</style>
