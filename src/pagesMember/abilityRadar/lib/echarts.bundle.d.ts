/**
 * echarts.bundle.js 的类型声明（手写，不用生成）
 *
 * 只声明本项目真正会用到的成员，避免为了类型把 echarts 的类型包也拖进来。
 * 生成脚本见 scripts/build-echarts-bundle.mjs。
 */
declare const echarts: {
  /** 注册图表与组件 */
  use: (components: unknown[]) => void;
  /** 初始化图表实例 */
  init: (...args: any[]) => any;
  /** 注册平台 API（uni-echarts 内部会调用） */
  setPlatformAPI: (api: Record<string, unknown>) => void;
  /** 注册 option 预处理钩子（uni-echarts 内部会调用） */
  registerPreprocessor: (fn: (option: unknown) => unknown) => void;
  /** 其余 API 按需透传 */
  [key: string]: any;
};

export default echarts;
