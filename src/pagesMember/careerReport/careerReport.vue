<template>
  <view class="report-page">
    <scroll-view
      scroll-y
      class="page-scroll"
    >
      <!-- ========== 没有能力画像 ========== -->
      <view
        v-if="!student"
        class="state-card card-style"
      >
        <text class="state-title">还没有你的能力画像</text>
        <text class="state-desc">
          生涯发展报告需要以你的能力画像为基础。请先填写专业、技能与经历并生成画像。
        </text>
        <button
          class="primary-btn"
          @click="goAbilityProfile"
        >
          去生成能力画像
        </button>
      </view>

      <!-- ========== 生成中 ========== -->
      <view
        v-else-if="generating"
        class="state-card card-style"
      >
        <view class="spinner" />
        <text class="state-title">正在生成生涯发展报告</text>
        <text class="state-desc">正在比对人岗匹配结果并推导成长计划…</text>
      </view>

      <block v-else-if="report">
        <!-- ========== 报告抬头 ========== -->
        <view class="header-card card-style">
          <text class="header-title">个性化职业生涯发展报告</text>
          <view class="header-meta">
            <text class="meta-item">{{ report.student.major || '专业未填写' }}</text>
            <text class="meta-dot">·</text>
            <text class="meta-item">{{ report.student.gradeLabel || '年级未填写' }}</text>
            <text
              v-if="report.student.targetJob"
              class="meta-dot"
            >
              ·
            </text>
            <text
              v-if="report.student.targetJob"
              class="meta-item"
            >
              意向 {{ report.student.targetJob }}
            </text>
          </view>
          <view class="header-scores">
            <view class="hs-item">
              <text class="hs-num">{{ report.student.competitiveness }}</text>
              <text class="hs-label">综合竞争力</text>
            </view>
            <view class="hs-item">
              <text class="hs-num">{{ report.student.completeness }}%</text>
              <text class="hs-label">信息完整度</text>
            </view>
            <view class="hs-item">
              <text class="hs-num">{{ progress.percent }}%</text>
              <text class="hs-label">计划完成率</text>
            </view>
          </view>
          <text class="header-time">生成时间：{{ generatedAtText }}</text>
        </view>

        <!-- 历史版本提示 -->
        <view
          v-if="isHistoryView"
          class="history-banner card-style"
        >
          <view class="history-banner-left">
            <text class="history-banner-title">正在查看历史版本</text>
            <text class="history-banner-desc">
              这是 {{ generatedAtText }} 存档的报告，内容为当时的数据快照。
            </text>
          </view>
          <button
            class="history-banner-btn"
            @click="backToLatest"
          >
            回到最新
          </button>
        </view>

        <!-- 数据来源说明 -->
        <view
          v-if="report.parseMethod === 'rule'"
          class="source-card card-style"
        >
          <text class="source-note">
            当前画像由本地规则解析生成（置信度 {{ Math.round(report.confidence * 100) }}%），
            报告结论仅作方向性参考。接入千问大模型解析后，差距判断与建议会显著更细。
          </text>
        </view>

        <!-- ==================== 一、人岗匹配分析 ==================== -->
        <view class="section-card card-style">
          <view class="section-head">
            <text class="section-no">一</text>
            <text class="section-title">职业探索与人岗匹配分析</text>
          </view>
          <text class="section-text">{{ report.matchSummary }}</text>

          <block v-if="report.bestMatch">
            <!-- 四维 -->
            <text class="sub-title">四大维度契合度</text>
            <view class="cat-grid">
              <view
                v-for="c in report.bestMatch.categories"
                :key="c.key"
                class="cat-item"
              >
                <text class="cat-score">{{ c.score }}</text>
                <text class="cat-label">{{ c.label }}</text>
                <view class="cat-bar">
                  <view
                    class="cat-bar-fill"
                    :style="{ width: `${c.score}%` }"
                  />
                </view>
              </view>
            </view>

            <!-- 十维差距 -->
            <text class="sub-title">十大能力项差距</text>
            <text class="sub-note">
              达成度 = 已满足的比例（技能/证书按岗位要求条目计，其余按个人水平占岗位要求的比例计）
            </text>
            <view
              v-for="g in report.bestMatch.gaps"
              :key="g.key"
              class="gap-row"
            >
              <text class="gap-label">{{ g.label }}</text>
              <view class="gap-bars">
                <view class="gap-track">
                  <view
                    class="gap-fill"
                    :class="g.satisfied ? 'ok' : 'short'"
                    :style="{ width: `${g.fitPercent}%` }"
                  />
                </view>
              </view>
              <text class="gap-percent">{{ g.noRequirement ? '—' : `${g.fitPercent}%` }}</text>
              <text
                class="gap-status"
                :class="{ ok: g.satisfied }"
              >
                {{ gapStatusText(g) }}
              </text>
            </view>

            <!-- 缺口 -->
            <view
              v-if="report.bestMatch.skillGaps.length"
              class="chip-block"
            >
              <text class="sub-title">硬技能缺口</text>
              <view class="chip-group">
                <text
                  v-for="(s, i) in report.bestMatch.skillGaps"
                  :key="`sk-${i}`"
                  class="chip must"
                >
                  {{ s.name }}
                </text>
              </view>
            </view>
            <view
              v-if="report.bestMatch.certGaps.length"
              class="chip-block"
            >
              <text class="sub-title">证书缺口</text>
              <view class="chip-group">
                <text
                  v-for="(c, i) in report.bestMatch.certGaps"
                  :key="`ct-${i}`"
                  class="chip must"
                >
                  {{ c.name }}
                </text>
              </view>
            </view>

            <!-- 岗位排序 -->
            <text class="sub-title">适配岗位排序（前 5）</text>
            <view
              v-for="(m, i) in report.matches"
              :key="m.jobId + i"
              class="rank-row"
            >
              <text class="rank-no">{{ i + 1 }}</text>
              <view class="rank-info">
                <text class="rank-job">{{ m.jobName }}</text>
                <text class="rank-ent">{{ m.enterpriseName || '未提供企业信息' }}</text>
              </view>
              <text
                class="rank-score"
                :style="{ color: matchColor(m.matchLevel) }"
              >
                {{ m.matchScore }}%
              </text>
            </view>
          </block>
        </view>

        <!-- ==================== 二、职业目标与路径 ==================== -->
        <view class="section-card card-style">
          <view class="section-head">
            <text class="section-no">二</text>
            <text class="section-title">职业目标与职业路径规划</text>
          </view>

          <view
            class="goal-block"
            @click="editGoal('shortTermGoal')"
          >
            <view class="goal-head">
              <text class="goal-label">短期目标（1–3个月）</text>
              <text class="goal-edit">编辑</text>
            </view>
            <text class="goal-text">{{ report.shortTermGoal }}</text>
          </view>

          <view
            class="goal-block"
            @click="editGoal('longTermGoal')"
          >
            <view class="goal-head">
              <text class="goal-label">长期目标</text>
              <text class="goal-edit">编辑</text>
            </view>
            <text class="goal-text">{{ report.longTermGoal }}</text>
          </view>

          <text class="sub-title">行业需求与发展趋势</text>
          <text class="section-text">{{ report.industryTrend }}</text>

          <block v-if="report.careerPath.verticalPath.length">
            <text class="sub-title">垂直晋升路径</text>
            <view class="vertical-chain">
              <view
                v-for="(step, i) in report.careerPath.verticalPath"
                :key="`v-${i}`"
                class="vertical-step"
              >
                <text
                  class="vertical-node"
                  :class="{ current: i === 0 }"
                >
                  {{ step }}
                </text>
                <text
                  v-if="i < report.careerPath.verticalPath.length - 1"
                  class="vertical-arrow"
                >
                  ↓
                </text>
              </view>
            </view>
          </block>

          <block v-if="report.careerPath.lateralPaths.length">
            <text class="sub-title">跨岗换路路径</text>
            <text class="sub-note">基于能力要求相似度计算，以下方向属于平滑转岗路径</text>
            <view
              v-for="(p, i) in report.careerPath.lateralPaths"
              :key="`l-${i}`"
              class="lateral-card"
            >
              <view class="lateral-head">
                <text class="lateral-job">{{ p.jobName }}</text>
                <text class="lateral-sim">相似度 {{ Math.round(p.similarity * 100) }}%</text>
              </view>
              <text
                v-if="p.industry"
                class="lateral-industry"
              >
                {{ p.industry }}
              </text>
              <text class="lateral-reason">{{ p.reason }}</text>
            </view>
          </block>
        </view>

        <!-- ==================== 三、分阶段成长计划 ==================== -->
        <view class="section-card card-style">
          <view class="section-head">
            <text class="section-no">三</text>
            <text class="section-title">分阶段个性化成长计划</text>
          </view>
          <text class="sub-note">
            已完成 {{ progress.done }} / {{ progress.total }} 项（{{ progress.percent }}%），点击任务可勾选
          </text>

          <view
            v-for="phase in phases"
            :key="phase"
            class="phase-block"
          >
            <view class="phase-head">
              <text class="phase-title">{{ phaseLabel(phase) }}</text>
              <text class="phase-count">
                {{ progress.byPhase[phase].done }}/{{ progress.byPhase[phase].total }}
              </text>
            </view>
            <view
              v-for="t in tasksOfPhase(phase)"
              :key="t.id"
              class="task-item"
              :class="{ done: t.done }"
              @click="toggleTask(t.id)"
            >
              <view
                class="task-check"
                :class="{ checked: t.done }"
              >
                <text v-if="t.done">✓</text>
              </view>
              <view class="task-body">
                <text class="task-title">{{ t.title }}</text>
                <view class="task-tags">
                  <text
                    class="task-tag"
                    :class="t.priority"
                  >
                    {{ priorityLabel(t.priority) }}
                  </text>
                  <text class="task-tag month">第 {{ t.dueMonth }} 个月</text>
                </view>
                <text class="task-detail">{{ t.detail }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- ==================== 四、评估机制 ==================== -->
        <view class="section-card card-style">
          <view class="section-head">
            <text class="section-no">四</text>
            <text class="section-title">评估周期与动态调整机制</text>
          </view>
          <view
            v-for="m in report.milestones"
            :key="m.month"
            class="milestone-item"
          >
            <view class="milestone-dot" />
            <view class="milestone-body">
              <text class="milestone-label">{{ m.label }}</text>
              <text class="milestone-focus">{{ m.focus }}</text>
              <view class="chip-group">
                <text
                  v-for="(mt, i) in m.metrics"
                  :key="`m-${i}`"
                  class="chip metric"
                >
                  {{ mt }}
                </text>
              </view>
            </view>
          </view>
          <text class="section-text">
            每次复盘后重新生成本报告，与上一版对比能力画像变化，动态调整成长路径。
          </text>
        </view>

        <!-- ==================== 操作区 ==================== -->
        <view class="action-card card-style">
          <text class="action-title">导出与分享</text>
          <text class="action-note">
            报告全文可一键复制（Markdown 格式），用于作业提交、就业存档或发给指导老师。
          </text>
          <button
            class="primary-btn"
            @click="copyMarkdown"
          >
            复制报告全文
          </button>
          <view class="action-row">
            <button
              class="ghost-btn"
              @click="exportAs('pdf')"
            >
              导出 PDF
            </button>
            <button
              class="ghost-btn"
              @click="exportAs('docx')"
            >
              导出 Word
            </button>
          </view>
          <button
            class="history-btn"
            @click="goReportHistory"
          >
            🕘 历史报告记录
          </button>
          <button
            class="text-btn"
            @click="regenerate"
          >
            重新生成报告
          </button>
        </view>
      </block>

      <view class="page-footer-source">
        <text class="source-text">
          本报告由职途智行根据能力画像与人岗匹配结果自动生成，仅供生涯规划参考
        </text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onUnload, onShareAppMessage } from '@dcloudio/uni-app';
import {
  CAREER_REPORT_STORAGE_KEY,
  PLAN_PHASE_LABEL,
  TASK_PRIORITY_LABEL,
  calcTaskProgress,
  type CareerReport,
  type PlanPhase,
  type TaskPriority,
} from '@/types/careerReport';
import { MATCH_LEVEL_COLOR, type DimensionGap, type MatchLevel } from '@/types/jobMatch';
import { STUDENT_PROFILE_STORAGE_KEY, type StudentProfile } from '@/types/studentProfile';
import { buildCareerReport, refreshReportMarkdown } from './lib/careerReport';
import { getSampleJobProfiles } from '@/utils/jobProfileSamples';
import { exportCareerReport, type ExportFormat } from './lib/careerReportApi';
import {
  getHistoryEntry,
  pushReportHistory,
  updateHistoryEntry,
} from '@/utils/reportHistory';

// ====================== 状态 ======================

const student = ref<StudentProfile | null>(null);
const report = ref<CareerReport | null>(null);
const generating = ref(false);

/** 是否正在查看历史版本（历史版本只读，不参与重算） */
const isHistoryView = ref(false);

const phases: PlanPhase[] = ['short', 'medium', 'long'];

let unloaded = false;
onUnload(() => {
  unloaded = true;
});

// ====================== 派生 ======================

const progress = computed(() =>
  calcTaskProgress(report.value?.tasks ?? [])
);

const generatedAtText = computed(() => {
  if (!report.value) return '';
  const d = new Date(report.value.generatedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
});

const tasksOfPhase = (phase: PlanPhase) =>
  (report.value?.tasks ?? []).filter((t) => t.phase === phase);

const phaseLabel = (phase: PlanPhase) => PLAN_PHASE_LABEL[phase];
const priorityLabel = (p: TaskPriority) => TASK_PRIORITY_LABEL[p];
const matchColor = (level: MatchLevel) => MATCH_LEVEL_COLOR[level] ?? '#94a3b8';

/**
 * 维度状态文案。
 * 刻意不再显示「差 X 分」：专业技能/证书是按条目覆盖率算的，
 * 用分值差展示会和上面的达成度条自相矛盾。
 */
const gapStatusText = (g: DimensionGap): string => {
  if (g.noRequirement) return '岗位未提要求';
  if (g.satisfied) return '已达标';
  if (g.insufficientInfo) return '信息不足';
  return g.basis === 'coverage' ? '覆盖不足' : '未达标';
};

// ====================== 存储 ======================

const readStudent = (): StudentProfile | null => {
  try {
    const raw = uni.getStorageSync(STUDENT_PROFILE_STORAGE_KEY);
    return raw && typeof raw === 'object' ? (raw as StudentProfile) : null;
  } catch {
    return null;
  }
};

const readReport = (): CareerReport | null => {
  try {
    const raw = uni.getStorageSync(CAREER_REPORT_STORAGE_KEY);
    return raw && typeof raw === 'object' && Array.isArray((raw as CareerReport).tasks)
      ? (raw as CareerReport)
      : null;
  } catch {
    return null;
  }
};

const saveReport = () => {
  if (!report.value) return;
  try {
    uni.setStorageSync(CAREER_REPORT_STORAGE_KEY, report.value);
  } catch {
    // 存储失败不影响展示
  }
};

// ====================== 生成 ======================

const generate = (previousTasks = report.value?.tasks) => {
  if (!student.value) return;
  generating.value = true;

  // 本地纯计算，用微任务让 loading 先渲染出来再算
  setTimeout(() => {
    if (unloaded || !student.value) {
      generating.value = false;
      return;
    }
    try {
      const built = buildCareerReport(student.value, getSampleJobProfiles(), {
        topN: 5,
        previousTasks,
      });
      report.value = built;
      saveReport();
      // 每次生成都归档一份历史，供后续回看与趋势对比
      pushReportHistory(built);
      isHistoryView.value = false;
    } catch (err) {
      console.error('生成生涯报告失败：', err);
      uni.showToast({ title: '生成失败，请重试', icon: 'none', duration: 2000 });
    } finally {
      generating.value = false;
    }
  }, 50);
};

const regenerate = () => {
  uni.showModal({
    title: '重新生成报告',
    content: '将按当前能力画像重新计算，已完成的任务勾选会保留。',
    success: (res) => {
      if (res.confirm) generate();
    },
  });
};

// ====================== 交互 ======================

/** 勾选/取消任务（成长计划的"可追踪"落点） */
const toggleTask = (taskId: string) => {
  if (!report.value) return;
  const tasks = report.value.tasks.map((t) =>
    t.id === taskId ? { ...t, done: !t.done } : t
  );
  report.value = refreshReportMarkdown({ ...report.value, tasks });
  saveReport();
  // 同步到历史，保证「历史列表里的完成率」和当前一致
  updateHistoryEntry(report.value);
};

/** 编辑职业目标（计划书要求支持手动修改） */
const editGoal = (field: 'shortTermGoal' | 'longTermGoal') => {
  if (!report.value) return;
  const current = report.value[field];
  uni.showModal({
    title: field === 'shortTermGoal' ? '编辑短期目标' : '编辑长期目标',
    editable: true,
    placeholderText: current,
    content: current,
    success: (res) => {
      if (!res.confirm) return;
      const next = (res.content ?? '').trim();
      if (!next) {
        uni.showToast({ title: '目标不能为空', icon: 'none', duration: 1500 });
        return;
      }
      report.value = refreshReportMarkdown({ ...report.value!, [field]: next });
      saveReport();
      updateHistoryEntry(report.value);
      uni.showToast({ title: '已保存', icon: 'success', duration: 1200 });
    },
  });
};

const goAbilityProfile = () => {
  // 能力画像现在是 tabBar 页面，只能用 switchTab
  uni.switchTab({ url: '/pages/abilityProfile/abilityProfile' });
};

/** 打开历史报告列表 */
const goReportHistory = () => {
  uni.navigateTo({
    url: '/pagesMember/reportHistory/reportHistory',
    fail: (err) => {
      console.error('打开历史报告失败：', err);
      uni.showToast({ title: '打开失败，请重试', icon: 'none', duration: 2000 });
    },
  });
};

/**
 * 从历史版本回到最新。
 * 优先用当前缓存的最新报告；若没有（例如缓存已被覆盖）则按当前画像重算。
 */
const backToLatest = () => {
  isHistoryView.value = false;
  const latest = readReport();
  if (latest) {
    report.value = latest;
    return;
  }
  student.value = readStudent();
  if (student.value) generate();
};

// ====================== 导出 ======================

const copyMarkdown = () => {
  if (!report.value) return;
  uni.setClipboardData({
    data: report.value.markdown,
    success: () => {
      uni.showToast({ title: '报告全文已复制', icon: 'success', duration: 1800 });
    },
    fail: () => {
      uni.showToast({ title: '复制失败，请重试', icon: 'none', duration: 2000 });
    },
  });
};

const exportAs = async (format: ExportFormat) => {
  if (!report.value) return;

  uni.showLoading({ title: '正在导出…', mask: true });
  const result = await exportCareerReport(report.value, format);
  uni.hideLoading();

  if (result.ok) {
    uni.showToast({ title: '导出成功', icon: 'success', duration: 1800 });
    return;
  }

  // 降级：诚实说明原因，并引导用「复制全文」完成同样目的
  uni.showModal({
    title: '在线导出暂不可用',
    content:
      `原因：${result.reason ?? '未知'}\n\n` +
      '后端导出接口尚未就绪。你可以先用「复制报告全文」，' +
      '把 Markdown 内容粘贴到 Word 或任意 Markdown 编辑器中另存为 PDF/Word，效果一致。',
    confirmText: '复制全文',
    cancelText: '知道了',
    success: (res) => {
      if (res.confirm) copyMarkdown();
    },
  });
};

// ====================== 生命周期 ======================

onLoad((options) => {
  // ---- 历史版本模式：只读展示某一份历史报告 ----
  const historyId = options?.historyId ? decodeURIComponent(options.historyId) : '';
  if (historyId) {
    const entry = getHistoryEntry(historyId);
    if (entry) {
      report.value = entry.report;
      isHistoryView.value = true;
      return;
    }
    uni.showToast({ title: '该历史报告已不存在', icon: 'none', duration: 2000 });
  }

  student.value = readStudent();
  if (!student.value) return;

  const cached = readReport();

  if (cached) {
    // ---- 缓存校验（这是之前漏掉的一步）----
    // 只判断「有没有缓存」是不够的：用户改完能力画像再进来，
    // 底层数据已经变了，却还在显示旧报告，而且没有任何提示。
    // 这里用能力画像的 parsed_at 当版本指纹，不一致就重算。
    const cachedFingerprint = cached.sourceStudentParsedAt || '';
    const currentFingerprint = student.value.parsed_at || '';

    if (cachedFingerprint === currentFingerprint) {
      report.value = cached;
      return;
    }

    console.log('[生涯报告] 能力画像已更新，缓存失效，重新生成');
    uni.showToast({
      title: '检测到能力画像已更新，正在重新生成',
      icon: 'none',
      duration: 2200,
    });
    // 重算时把已完成的任务勾选带过去，不丢用户进度
    generate(cached.tasks);
    return;
  }

  generate();
});

// ====================== 分享 ======================

onShareAppMessage(() => ({
  title: report.value?.bestMatch
    ? `我的生涯发展报告：与${report.value.bestMatch.jobName}匹配度 ${report.value.bestMatch.matchScore}%`
    : '生成我的个性化职业生涯发展报告',
  path: '/pagesMember/careerReport/careerReport',
}));
</script>

<style scoped lang="scss">
.report-page {
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
  margin-bottom: 24rpx;
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

// ========== 抬头 ==========
.header-card {
  background: linear-gradient(135deg, #fff5f1 0%, #fff 100%);
  border-color: #ffd9c7;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
}

.header-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 12rpx;
}

.meta-item {
  font-size: 23rpx;
  color: #6b7280;
}

.meta-dot {
  font-size: 23rpx;
  color: #cbd5e1;
  margin: 0 10rpx;
}

.header-scores {
  display: flex;
  margin-top: 24rpx;
}

.hs-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hs-num {
  font-size: 40rpx;
  font-weight: 700;
  color: #ff4500;
  line-height: 1.1;
}

.hs-label {
  font-size: 20rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}

.header-time {
  font-size: 21rpx;
  color: #9ca3af;
  margin-top: 20rpx;
  display: block;
}

// ========== 来源提示 ==========
.source-card {
  background: #fffbeb;
  border-color: #fde68a;
}

.source-note {
  font-size: 23rpx;
  color: #92400e;
  line-height: 1.6;
  display: block;
}

// ========== 章节 ==========
.section-card {
  padding: 26rpx 28rpx;
}

.section-head {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-no {
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  border-radius: 10rpx;
  background: #ff4500;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.section-text {
  font-size: 25rpx;
  color: #374151;
  line-height: 1.75;
  display: block;
}

.sub-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
  margin: 24rpx 0 12rpx;
}

.sub-note {
  font-size: 21rpx;
  color: #9ca3af;
  line-height: 1.6;
  display: block;
  margin-bottom: 12rpx;
}

// ========== 四维 ==========
.cat-grid {
  display: flex;
}

.cat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cat-score {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}

.cat-label {
  font-size: 20rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.cat-bar {
  width: 100rpx;
  height: 8rpx;
  background: #f1f5f9;
  border-radius: 4rpx;
  margin-top: 10rpx;
  overflow: hidden;
}

.cat-bar-fill {
  height: 100%;
  background: #ff4500;
  border-radius: 4rpx;
}

// ========== 十维差距 ==========
.gap-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
}

.gap-label {
  width: 130rpx;
  font-size: 23rpx;
  color: #4b5563;
  flex-shrink: 0;
}

.gap-bars {
  flex: 1;
  padding-right: 14rpx;
}

.gap-track {
  height: 8rpx;
  background: #f1f5f9;
  border-radius: 4rpx;
  overflow: hidden;
  margin-bottom: 4rpx;
}

.gap-fill {
  height: 100%;
  border-radius: 4rpx;

  &.ok {
    background: #16a34a;
  }

  &.short {
    background: #ff4500;
  }
}

.gap-percent {
  width: 68rpx;
  text-align: right;
  font-size: 22rpx;
  font-weight: 600;
  color: #4b5563;
  flex-shrink: 0;
}

.gap-status {
  width: 118rpx;
  text-align: right;
  font-size: 21rpx;
  color: #dc2626;
  flex-shrink: 0;

  &.ok {
    color: #16a34a;
  }
}

// ========== chips ==========
.chip-block {
  margin-top: 6rpx;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.chip {
  font-size: 21rpx;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
  background: #f1f5f9;
  color: #475569;

  &.must {
    background: #fef2f2;
    color: #dc2626;
    font-weight: 600;
  }

  &.metric {
    background: #fff1eb;
    color: #9a3412;
  }
}

// ========== 岗位排序 ==========
.rank-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f8fafc;

  &:last-child {
    border-bottom: none;
  }
}

.rank-no {
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  font-size: 20rpx;
  font-weight: 700;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.rank-info {
  flex: 1;
}

.rank-job {
  font-size: 25rpx;
  color: #1f2937;
  font-weight: 600;
  display: block;
}

.rank-ent {
  font-size: 20rpx;
  color: #9ca3af;
  margin-top: 2rpx;
  display: block;
}

.rank-score {
  font-size: 28rpx;
  font-weight: 700;
  flex-shrink: 0;
}

// ========== 目标 ==========
.goal-block {
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 18rpx 20rpx;
  margin-bottom: 14rpx;
}

.goal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.goal-label {
  font-size: 23rpx;
  font-weight: 700;
  color: #ff4500;
}

.goal-edit {
  font-size: 21rpx;
  color: #9ca3af;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  padding: 2rpx 14rpx;
}

.goal-text {
  font-size: 24rpx;
  color: #374151;
  line-height: 1.7;
  display: block;
}

// ========== 晋升链 ==========
.vertical-chain {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vertical-step {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vertical-node {
  font-size: 23rpx;
  color: #1f2937;
  background: #f1f5f9;
  border-radius: 10rpx;
  padding: 8rpx 24rpx;

  &.current {
    background: #fff1eb;
    border: 1rpx solid #ffd0bb;
    color: #ff4500;
    font-weight: 700;
  }
}

.vertical-arrow {
  font-size: 22rpx;
  color: #ff4500;
  line-height: 1.5;
}

// ========== 跨岗 ==========
.lateral-card {
  background: #f0fdf4;
  border: 1rpx solid #bbf7d0;
  border-radius: 12rpx;
  padding: 18rpx 20rpx;
  margin-bottom: 14rpx;
}

.lateral-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lateral-job {
  font-size: 26rpx;
  font-weight: 700;
  color: #15803d;
}

.lateral-sim {
  font-size: 21rpx;
  color: #16a34a;
  font-weight: 600;
}

.lateral-industry {
  font-size: 20rpx;
  color: #9ca3af;
  margin-top: 4rpx;
  display: block;
}

.lateral-reason {
  font-size: 22rpx;
  color: #4b5563;
  line-height: 1.65;
  margin-top: 8rpx;
  display: block;
}

// ========== 任务 ==========
.phase-block {
  margin-top: 24rpx;
}

.phase-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10rpx;
  border-bottom: 2rpx solid #ff4500;
}

.phase-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
}

.phase-count {
  font-size: 21rpx;
  color: #9ca3af;
}

.task-item {
  display: flex;
  align-items: flex-start;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f8fafc;

  &.done {
    .task-title {
      color: #9ca3af;
      text-decoration: line-through;
    }
  }
}

.task-check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid #cbd5e1;
  margin-right: 16rpx;
  margin-top: 2rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: #fff;

  &.checked {
    background: #16a34a;
    border-color: #16a34a;
  }
}

.task-body {
  flex: 1;
}

.task-title {
  font-size: 25rpx;
  font-weight: 600;
  color: #1f2937;
  display: block;
  line-height: 1.5;
}

.task-tags {
  display: flex;
  gap: 10rpx;
  margin: 8rpx 0;
}

.task-tag {
  font-size: 19rpx;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;

  &.high {
    background: #fef2f2;
    color: #dc2626;
  }

  &.medium {
    background: #fff7ed;
    color: #c2410c;
  }

  &.low {
    background: #f1f5f9;
    color: #64748b;
  }

  &.month {
    background: #f1f5f9;
    color: #64748b;
  }
}

.task-detail {
  font-size: 22rpx;
  color: #6b7280;
  line-height: 1.7;
  display: block;
}

// ========== 评估节点 ==========
.milestone-item {
  display: flex;
  align-items: flex-start;
  padding: 14rpx 0;
}

.milestone-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #ff4500;
  margin: 10rpx 18rpx 0 4rpx;
  flex-shrink: 0;
}

.milestone-body {
  flex: 1;
}

.milestone-label {
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
}

.milestone-focus {
  font-size: 22rpx;
  color: #6b7280;
  line-height: 1.6;
  margin: 6rpx 0 10rpx;
  display: block;
}

// ========== 操作 ==========
.action-card {
  padding: 26rpx 28rpx;
}

.action-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
}

.action-note {
  font-size: 22rpx;
  color: #6b7280;
  line-height: 1.6;
  margin: 10rpx 0 20rpx;
  display: block;
}

.action-row {
  display: flex;
  gap: 20rpx;
  margin-top: 20rpx;
}

.primary-btn,
.ghost-btn {
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
  width: 100%;
  background: #ff4500;
  color: #fff;
}

.ghost-btn {
  flex: 1;
  background: #fff;
  color: #ff4500;
  border: 2rpx solid #ff4500;
}

.text-btn {
  width: 100%;
  margin: 24rpx 0 0;
  padding: 0;
  background: transparent;
  color: #9ca3af;
  font-size: 24rpx;
  line-height: 60rpx;

  &::after {
    border: none;
  }
}

// ========== 历史版本提示 ==========
.history-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #eff6ff 0%, #fff 100%);
  border-color: #bfdbfe;
}

.history-banner-left {
  flex: 1;
  padding-right: 18rpx;
}

.history-banner-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #1d4ed8;
  display: block;
}

.history-banner-desc {
  font-size: 21rpx;
  color: #6b7280;
  line-height: 1.5;
  margin-top: 6rpx;
  display: block;
}

.history-banner-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 0 24rpx;
  height: 62rpx;
  line-height: 62rpx;
  border-radius: 14rpx;
  font-size: 24rpx;
  font-weight: 600;
  background: #1d4ed8;
  color: #fff;

  &::after {
    border: none;
  }
}

// 历史记录入口按钮
.history-btn {
  width: 100%;
  margin: 20rpx 0 0;
  padding: 0;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 16rpx;
  font-size: 27rpx;
  font-weight: 600;
  background: #f8fafc;
  color: #334155;
  border: 2rpx solid #e5e7eb;

  &::after {
    border: none;
  }
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
