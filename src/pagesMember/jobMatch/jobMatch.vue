<template>
  <view class="match-page">
    <scroll-view
      scroll-y
      class="page-scroll"
    >
      <!-- ========== 没有学生画像 ========== -->
      <view
        v-if="!student && !loading"
        class="state-card card-style"
      >
        <text class="state-title">还没有你的能力画像</text>
        <text class="state-desc">
          人岗匹配需要先建立你的能力画像。请先填写专业、技能与经历，生成画像后再回来匹配岗位。
        </text>
        <button
          class="primary-btn"
          @click="goAbilityProfile"
        >
          去生成能力画像
        </button>
      </view>

      <block v-else>
        <!-- ========== 我的画像摘要 ========== -->
        <view class="me-card card-style">
          <view class="me-left">
            <text class="me-major">{{ student?.major || '未填写专业' }}</text>
            <text class="me-sub">
              {{ student?.grade_label || '未填写年级' }}
              <text v-if="student?.target_job"> · 意向 {{ student?.target_job }}</text>
            </text>
          </view>
          <view class="me-right">
            <text class="me-score">{{ student?.competitiveness ?? 0 }}</text>
            <text class="me-score-label">竞争力</text>
          </view>
        </view>

        <!-- ========== 匹配中 ========== -->
        <view
          v-if="loading"
          class="state-card card-style"
        >
          <view class="spinner" />
          <text class="state-title">正在计算匹配度</text>
          <text class="state-desc">{{ progressText || '正在准备岗位数据…' }}</text>
        </view>

        <!-- ========== 出错 ========== -->
        <view
          v-else-if="errorMsg"
          class="state-card card-style"
        >
          <text class="state-title">匹配失败</text>
          <text class="state-desc">{{ errorMsg }}</text>
          <button
            class="primary-btn"
            @click="reload"
          >
            重试
          </button>
        </view>

        <block v-else>
          <!-- ========== 数据来源说明 ========== -->
          <view
            class="source-card card-style"
            :class="{ sample: usingSampleJobs }"
          >
            <text class="source-title">
              {{ usingSampleJobs ? '当前为示例岗位演示' : '当前为真实岗位匹配' }}
            </text>
            <text class="source-note">
              {{
                usingSampleJobs
                  ? '后端岗位列表需要登录后获取，这里先用内置的示例岗位展示匹配效果。登录后可匹配聊城大学校招合作企业的真实岗位。'
                  : '岗位画像由千问大模型解析招聘信息生成，匹配结果可直接用于投递决策参考。'
              }}
            </text>
            <text
              v-if="isRuleBasedAll"
              class="source-warn"
            >
              注：两侧画像至少有一侧来自本地规则解析，匹配度仅作方向性参考，会低估未写清楚的经历。
            </text>
          </view>

          <!-- ========== 结果列表 ========== -->
          <view
            v-for="(r, idx) in results"
            :key="r.jobId + idx"
            class="result-card card-style"
          >
            <!-- 头部 -->
            <view class="result-head">
              <view class="result-title-wrap">
                <text class="result-job">{{ r.jobName }}</text>
                <text class="result-ent">{{ r.enterpriseName || '未提供企业信息' }}</text>
                <text
                  v-if="r.industry"
                  class="result-industry"
                >
                  {{ r.industry }}
                </text>
              </view>
              <view class="result-score-wrap">
                <text
                  class="result-score"
                  :style="{ color: levelColor(r.matchLevel) }"
                >
                  {{ r.matchScore }}<text class="result-score-unit">%</text>
                </text>
                <text
                  class="result-level"
                  :style="{ color: levelColor(r.matchLevel) }"
                >
                  {{ r.matchLevelLabel }}
                </text>
              </view>
            </view>

            <!-- 匹配度条 -->
            <view class="bar-track">
              <view
                class="bar-fill"
                :style="{ width: `${r.matchScore}%`, backgroundColor: levelColor(r.matchLevel) }"
              />
            </view>

            <!-- 四维得分 -->
            <view class="cat-grid">
              <view
                v-for="c in r.categories"
                :key="c.key"
                class="cat-item"
              >
                <text class="cat-score">{{ c.score }}</text>
                <text class="cat-label">{{ c.label }}</text>
                <text class="cat-weight">权重{{ (c.weight * 100).toFixed(0) }}%</text>
              </view>
            </view>

            <!-- 摘要 -->
            <text class="result-summary">{{ r.summary }}</text>

            <!-- 展开详情 -->
            <view
              class="expand-trigger"
              @click="toggleExpand(idx)"
            >
              <text class="expand-text">
                {{ expandedIndex === idx ? '收起分析详情' : '查看十维差距与提升建议' }}
              </text>
              <text
                class="expand-arrow"
                :class="{ expanded: expandedIndex === idx }"
              >
                ▶
              </text>
            </view>

            <view
              v-if="expandedIndex === idx"
              class="detail-block"
            >
              <!-- 十维差距 -->
              <view class="detail-section">
                <view class="detail-head">
                  <text class="detail-title">十大维度对比</text>
                  <view class="legend">
                    <text class="legend-dot student" />
                    <text class="legend-text">我的能力</text>
                    <text class="legend-dot required" />
                    <text class="legend-text">岗位要求</text>
                  </view>
                </view>

                <view
                  v-for="g in r.gaps"
                  :key="g.key"
                  class="cmp-row"
                >
                  <view class="cmp-head">
                    <text class="cmp-label">{{ g.label }}</text>
                    <text
                      class="cmp-status"
                      :class="{ ok: g.satisfied }"
                    >
                      {{ gapStatusText(g) }}
                    </text>
                  </view>

                  <!-- 岗位未提要求：不参与评分，因此不画进度条，
                       避免出现「覆盖率 100%」配绿色满格条这种看起来像"已达标"的误导 -->
                  <block v-if="g.noRequirement">
                    <text class="cmp-num">岗位未对该维度提出可判定的要求，不参与评分</text>
                  </block>

                  <!-- 专业技能 / 证书：按岗位要求条目的覆盖率展示 -->
                  <block v-else-if="g.basis === 'coverage'">
                    <view class="cmp-bars">
                      <view class="cmp-track">
                        <view
                          class="cmp-fill"
                          :class="g.satisfied ? 'ok' : 'student'"
                          :style="{ width: `${g.fitPercent}%` }"
                        />
                      </view>
                    </view>
                    <text class="cmp-num">岗位要求条目覆盖率 {{ g.fitPercent }}%</text>
                  </block>

                  <!-- 其余维度：我的水平 vs 岗位要求 -->
                  <block v-else>
                    <view class="cmp-bars">
                      <view class="cmp-track">
                        <view
                          class="cmp-fill student"
                          :style="{ width: `${g.studentScore}%` }"
                        />
                      </view>
                      <view class="cmp-track">
                        <view
                          class="cmp-fill required"
                          :style="{ width: `${g.requiredScore}%` }"
                        />
                      </view>
                    </view>
                    <text class="cmp-num">{{ g.studentScore }} / {{ g.requiredScore }}</text>
                  </block>
                </view>
              </view>

              <!-- 技能缺口 -->
              <view
                v-if="r.skillGaps.length"
                class="detail-section"
              >
                <text class="detail-title">硬技能缺口（{{ r.skillGaps.length }} 项）</text>
                <view class="chip-group">
                  <text
                    v-for="(s, i) in r.skillGaps"
                    :key="`${s.name}-${i}`"
                    class="chip"
                    :class="s.requirement"
                  >
                    {{ s.name }}{{ s.requirement === 'must' ? ' ·必须' : '' }}
                  </text>
                </view>
              </view>

              <!-- 证书缺口 -->
              <view
                v-if="r.certGaps.length"
                class="detail-section"
              >
                <text class="detail-title">证书缺口（{{ r.certGaps.length }} 项）</text>
                <view class="chip-group">
                  <text
                    v-for="(c, i) in r.certGaps"
                    :key="`${c.name}-${i}`"
                    class="chip"
                    :class="c.requirement"
                  >
                    {{ c.name }}
                  </text>
                </view>
              </view>

              <!-- 关键短板 -->
              <view
                v-if="r.criticalGaps.length"
                class="detail-section"
              >
                <text class="detail-title">关键短板</text>
                <text
                  v-for="(cg, i) in r.criticalGaps"
                  :key="i"
                  class="gap-line"
                >
                  · {{ cg }}
                </text>
              </view>

              <!-- 提升建议 -->
              <view class="detail-section">
                <text class="detail-title">针对性提升建议</text>
                <view
                  v-for="(sg, i) in r.suggestions"
                  :key="i"
                  class="suggestion-item"
                >
                  <text class="suggestion-index">{{ i + 1 }}</text>
                  <text class="suggestion-text">{{ sg }}</text>
                </view>
              </view>

              <!-- 匹配信息 -->
              <view class="detail-section meta-section">
                <text class="meta-line">
                  达标维度 {{ r.satisfiedCount }}/{{ r.totalCount }} · 匹配置信度
                  {{ Math.round(r.confidence * 100) }}%
                </text>
              </view>
            </view>
          </view>
        </block>

        <!-- ========== 生涯报告入口 ========== -->
        <view class="report-entry card-style">
          <text class="report-entry-title">把匹配结果变成行动计划</text>
          <text class="report-entry-desc">
            生涯发展报告会汇总你的匹配分析、职业路径（含跨岗换路）、
            分阶段成长计划与评估节点，并支持导出存档。
          </text>
          <button
            class="primary-btn"
            @click="goCareerReport"
          >
            生成生涯发展报告
          </button>
        </view>
      </block>

      <view class="page-footer-source">
        <text class="source-text">
          匹配结果由能力画像与岗位画像自动计算得出，仅供生涯规划参考，不作为招聘录用依据
        </text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onUnload, onShareAppMessage } from '@dcloudio/uni-app';
import {
  MATCH_LEVEL_COLOR,
  type DimensionGap,
  type MatchLevel,
  type MatchResult,
} from '@/types/jobMatch';
import {
  STUDENT_PROFILE_STORAGE_KEY,
  type StudentProfile,
} from '@/types/studentProfile';
import { matchStudentToJob, rankJobsByMatch } from '@/utils/jobMatch';
import { getSampleJobProfiles } from '@/utils/jobProfileSamples';
import { fetchRecruitmentByCreditCode, generateJobProfile } from '@/api/jobProfile';

// ====================== 状态 ======================

const student = ref<StudentProfile | null>(null);
const results = ref<MatchResult[]>([]);
const usingSampleJobs = ref(true);
const expandedIndex = ref<number | null>(null);

const loading = ref(false);
const errorMsg = ref('');
const progressText = ref('');

let currentCreditCode = '';
let unloaded = false;

onUnload(() => {
  unloaded = true;
});

// ====================== 计算属性 ======================

/** 结果里是否存在基于本地规则解析的画像 */
const isRuleBasedAll = computed(() => results.value.some((r) => r.isRuleBased));

// ====================== 展示辅助 ======================

const levelColor = (level: MatchLevel): string => MATCH_LEVEL_COLOR[level] ?? '#94a3b8';

/**
 * 维度状态文案。
 * 专业技能/证书按覆盖率算，其余按分值算，因此不能统一写成「差 X 分」。
 */
const gapStatusText = (g: DimensionGap): string => {
  if (g.noRequirement) return '岗位未提要求';
  if (g.satisfied) return '已达标';
  if (g.insufficientInfo) return '信息不足';
  return g.basis === 'coverage' ? '覆盖不足' : '未达标';
};

const toggleExpand = (idx: number) => {
  expandedIndex.value = expandedIndex.value === idx ? null : idx;
};

const goAbilityProfile = () => {
  // 能力画像现在是 tabBar 页面，只能用 switchTab
  uni.switchTab({ url: '/pages/abilityProfile/abilityProfile' });
};

const goCareerReport = () => {
  uni.navigateTo({ url: '/pagesMember/careerReport/careerReport' });
};

// ====================== 数据加载 ======================

/** 读取本地保存的学生能力画像 */
const readStudentProfile = (): StudentProfile | null => {
  try {
    const raw = uni.getStorageSync(STUDENT_PROFILE_STORAGE_KEY);
    return raw && typeof raw === 'object' ? (raw as StudentProfile) : null;
  } catch {
    return null;
  }
};

/** 用示例岗位做批量匹配（离线可用） */
const matchWithSampleJobs = () => {
  if (!student.value) return;
  usingSampleJobs.value = true;
  results.value = rankJobsByMatch(student.value, getSampleJobProfiles());
  expandedIndex.value = 0;
};

/** 与单个真实岗位匹配 */
const matchWithRealJob = async (creditCode: string) => {
  if (!student.value) return;

  loading.value = true;
  errorMsg.value = '';
  usingSampleJobs.value = false;

  try {
    progressText.value = '正在读取岗位信息…';
    const recruitment = await fetchRecruitmentByCreditCode(creditCode);

    progressText.value = '正在生成岗位画像…';
    const generated = await generateJobProfile(
      {
        recruitment_id: recruitment.credit_code,
        job_name: recruitment.job_name,
        enterprise_name: recruitment.enterprise_name,
        industry: recruitment.industry,
        recruit_major: recruitment.recruit_major,
        monthly_salary: recruitment.monthly_salary,
        recruit_number: recruitment.recruit_number,
        enterprise_intro: recruitment.enterprise_intro,
      },
      { shouldStop: () => unloaded }
    );

    progressText.value = '正在计算匹配度…';
    results.value = [matchStudentToJob(student.value, generated.profile)];
    expandedIndex.value = 0;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    errorMsg.value = err instanceof Error ? err.message : '匹配失败，请稍后重试';
  } finally {
    loading.value = false;
    progressText.value = '';
  }
};

/** 重新加载（按当前模式） */
const reload = () => {
  if (currentCreditCode) {
    void matchWithRealJob(currentCreditCode);
  } else {
    matchWithSampleJobs();
  }
};

// ====================== 生命周期 ======================

onLoad((options) => {
  student.value = readStudentProfile();

  // 没有能力画像时直接停在这里，界面会提示去生成
  if (!student.value) return;

  currentCreditCode = options?.id ? decodeURIComponent(options.id) : '';

  if (currentCreditCode) {
    // 单岗位模式：需要联网 + 登录
    void matchWithRealJob(currentCreditCode);
  } else {
    // 批量模式：直接用示例岗位，离线可用
    matchWithSampleJobs();
  }
});

// ====================== 分享 ======================

onShareAppMessage(() => ({
  title: results.value.length
    ? `我的岗位匹配度 ${results.value[0].matchScore}%：${results.value[0].jobName}`
    : '测一测你和目标岗位的匹配度',
  path: '/pagesMember/jobMatch/jobMatch',
}));
</script>

<style scoped lang="scss">
.match-page {
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
  border-top-color: #FF7239;
  border-radius: 50%;
  margin-bottom: 26rpx;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// ========== 我的画像 ==========
.me-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #fff5f1 0%, #fff 100%);
  border-color: #ffd9c7;
}

.me-major {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
}

.me-sub {
  font-size: 23rpx;
  color: #6b7280;
  margin-top: 8rpx;
  display: block;
}

.me-right {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.me-score {
  font-size: 46rpx;
  font-weight: 700;
  color: #ff4500;
  line-height: 1.1;
}

.me-score-label {
  font-size: 20rpx;
  color: #9ca3af;
}

// ========== 数据来源 ==========
.source-card {
  background: #f0f9ff;
  border-color: #bae6fd;

  &.sample {
    background: #fffbeb;
    border-color: #fde68a;
  }
}

.source-title {
  font-size: 25rpx;
  font-weight: 700;
  color: #92400e;
  display: block;
}

.source-note {
  font-size: 23rpx;
  color: #6b7280;
  line-height: 1.6;
  margin-top: 10rpx;
  display: block;
}

.source-warn {
  font-size: 22rpx;
  color: #b45309;
  line-height: 1.6;
  margin-top: 10rpx;
  display: block;
}

// ========== 结果卡 ==========
.result-card {
  padding: 26rpx 28rpx;
}

.result-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.result-title-wrap {
  flex: 1;
  padding-right: 20rpx;
}

.result-job {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
}

.result-ent {
  font-size: 24rpx;
  color: #6b7280;
  margin-top: 6rpx;
  display: block;
}

.result-industry {
  font-size: 20rpx;
  color: #6b7280;
  background: #f1f5f9;
  border-radius: 6rpx;
  padding: 2rpx 12rpx;
  margin-top: 10rpx;
  display: inline-block;
}

.result-score-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.result-score {
  font-size: 56rpx;
  font-weight: 700;
  line-height: 1.05;
}

.result-score-unit {
  font-size: 26rpx;
}

.result-level {
  font-size: 21rpx;
  font-weight: 600;
  margin-top: 4rpx;
}

.bar-track {
  height: 12rpx;
  background: #f1f5f9;
  border-radius: 6rpx;
  margin-top: 18rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.4s ease;
}

// ========== 四维 ==========
.cat-grid {
  display: flex;
  margin-top: 22rpx;
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
  font-size: 21rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.cat-weight {
  font-size: 18rpx;
  color: #cbd5e1;
  margin-top: 2rpx;
}

.result-summary {
  font-size: 24rpx;
  color: #4b5563;
  line-height: 1.7;
  margin-top: 20rpx;
  display: block;
}

// ========== 展开 ==========
.expand-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #f1f5f9;
}

.expand-text {
  font-size: 24rpx;
  color: #ff4500;
  font-weight: 600;
}

.expand-arrow {
  font-size: 18rpx;
  color: #ff4500;
  margin-left: 10rpx;
  transition: transform 0.3s ease;

  &.expanded {
    transform: rotate(90deg);
  }
}

// ========== 详情 ==========
.detail-block {
  margin-top: 20rpx;
}

.detail-section {
  margin-top: 24rpx;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
  margin-bottom: 12rpx;
}

.legend {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.legend-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 4rpx;
  margin-left: 14rpx;

  &.student {
    background: #ff4500;
  }

  &.required {
    background: #cbd5e1;
  }
}

.legend-text {
  font-size: 19rpx;
  color: #9ca3af;
  margin-left: 6rpx;
}

// ========== 维度对比 ==========
.cmp-row {
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f8fafc;

  &:last-child {
    border-bottom: none;
  }
}

.cmp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cmp-label {
  font-size: 25rpx;
  color: #1f2937;
  font-weight: 600;
}

.cmp-status {
  font-size: 21rpx;
  color: #dc2626;

  &.ok {
    color: #16a34a;
  }
}

.cmp-bars {
  margin-top: 10rpx;
}

.cmp-track {
  height: 9rpx;
  background: #f1f5f9;
  border-radius: 5rpx;
  overflow: hidden;
  margin-bottom: 5rpx;
}

.cmp-fill {
  height: 100%;
  border-radius: 5rpx;

  &.student {
    background: #ff4500;
  }

  &.required {
    background: #cbd5e1;
  }

  &.ok {
    background: #16a34a;
  }
}

.cmp-num {
  font-size: 19rpx;
  color: #9ca3af;
}

// ========== chips ==========
.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip {
  font-size: 22rpx;
  border-radius: 8rpx;
  padding: 4rpx 14rpx;
  background: #f1f5f9;
  color: #475569;

  &.must {
    background: #fef2f2;
    color: #dc2626;
    font-weight: 600;
  }
}

.gap-line {
  font-size: 23rpx;
  color: #4b5563;
  line-height: 1.7;
  display: block;
}

// ========== 建议 ==========
.suggestion-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 14rpx;
}

.suggestion-index {
  width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  text-align: center;
  border-radius: 50%;
  background: #fff1eb;
  color: #ff4500;
  font-size: 20rpx;
  font-weight: 700;
  flex-shrink: 0;
  margin-right: 14rpx;
  margin-top: 2rpx;
}

.suggestion-text {
  font-size: 24rpx;
  color: #374151;
  line-height: 1.7;
  flex: 1;
}

.meta-section {
  border-top: 1rpx solid #f1f5f9;
  padding-top: 16rpx;
}

.meta-line {
  font-size: 21rpx;
  color: #9ca3af;
}

// ========== 生涯报告入口 ==========
.report-entry {
  background: linear-gradient(135deg, #f0f9ff 0%, #fff 100%);
  border-color: #bae6fd;
}

.report-entry-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #0369a1;
  display: block;
}

.report-entry-desc {
  font-size: 23rpx;
  color: #6b7280;
  line-height: 1.6;
  margin: 10rpx 0 20rpx;
  display: block;
}

// ========== 按钮 ==========
.primary-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  margin: 0;
  padding: 0;
  background: #FF7239;
  color: #fff;

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
