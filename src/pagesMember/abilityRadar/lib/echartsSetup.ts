/**
 * 小程序端 ECharts 装配入口
 *
 * ## 为什么这里引的是 ./echarts.bundle.js 而不是 npm 包
 *
 * uni-app 的小程序构建会把 **node_modules 依赖统一打进主包的 common/vendor.js**，
 * manifest 里的 optimization.subPackages 只搬项目源码、不搬 node_modules。
 * 也就是说：只要 `import ... from 'echarts/core'`，echarts（约 470KB）
 * 就会落在主包里 —— 哪怕只有分包页用到它。
 *
 * 而放在分包目录下的**项目源码**会被正确归入该分包（本项目已实测）。
 * 所以 echarts 被预打包成同目录下的 `echarts.bundle.js`，
 * 以"项目源码"的身份进入分包：主包回到 0.5MB 左右，
 * 只有真正点进「能力星球图」页时才下载这一份。
 *
 * ## 什么时候需要重新生成
 *
 * - 升级 echarts 版本之后
 * - 需要增删注册的图表/组件时（改 scripts/echarts-entry.js）
 *
 * 执行：`node scripts/build-echarts-bundle.mjs`
 */
import echarts from './echarts.bundle.js';

export default echarts;
