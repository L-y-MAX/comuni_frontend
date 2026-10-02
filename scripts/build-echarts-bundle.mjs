/**
 * 把 echarts 预打包成单文件，放进分包目录
 *
 *   node scripts/build-echarts-bundle.mjs
 *
 * ## 为什么要做这一步
 *
 * uni-app 的小程序构建会把 **node_modules 依赖统一打进主包的
 * `common/vendor.js`**，`manifest.json` 里的 `optimization.subPackages`
 * 只搬「项目源码」、不搬 node_modules。
 * 于是即使图表只被分包页使用，echarts 依然占着主包约 500KB。
 *
 * 而**放在分包目录下的项目源码**是会被正确归入该分包的（本项目已实测：
 * lib/radarOption.ts 就落在了分包里）。所以这里把 echarts 预打包成
 * `src/pagesMember/abilityRadar/lib/echarts.bundle.js`，它就以「项目源码」的身份
 * 进入分包，主包体积回到 0.5MB 左右。
 *
 * ## 什么时候需要重新跑
 *
 * - 升级 echarts 版本之后
 * - 需要新增/减少注册的图表与组件时（改 scripts/echarts-entry.js 再跑）
 *
 * ## 实现要点（都是踩过的坑）
 *
 * 1. 用项目里已有的 vite（lib 模式）解析并打包，不需要额外的 rollup 插件。
 * 2. `configFile: false`：不要加载项目的 vite.config.ts，否则会带上 uni() 插件，
 *    把一次纯库打包卷进小程序编译流程。
 * 3. 产物必须是 **ESM**：Vite 的 commonjs 插件默认只转换 node_modules，
 *    src/ 里的 CJS 会被 Rollup 当作 ESM 解析，`import default` 直接报错
 *    （报「"default" is not exported by ...」）。
 * 4. **压缩单独用 terser 的 API 做**，不依赖 Vite 的 build.minify
 *    （实测 lib + es 模式下它没有生效，产物会是 1.1MB 的未压缩代码）。
 *    terser 是纯 JS、进程内运行，不依赖 esbuild 子进程。
 * 5. 显式把 `process.env.NODE_ENV` 定义成 "production"：
 *    小程序里没有 process 对象，不定义会直接报错；
 *    顺便让 echarts 内部那些开发期告警分支被摇掉。
 */
import { build } from 'vite';
import { minify } from 'terser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const entry = path.join(here, 'echarts-entry.js');
const outDir = path.join(root, 'src', 'pagesMember', 'abilityRadar', 'lib');
const outFile = path.join(outDir, 'echarts.bundle.js');

if (!fs.existsSync(entry)) {
  console.error(`找不到打包入口：${entry}`);
  process.exit(1);
}

console.log('[1/3] 打包 echarts（vite lib 模式，ESM）...');
await build({
  root,
  // 关键：不要加载项目的 vite.config.ts。
  // 里面挂着 uni() 插件，会把这次纯库打包也卷进小程序编译流程。
  configFile: false,
  logLevel: 'warn',
  define: {
    // 小程序里没有 process 对象，必须定死，否则运行时报错
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    outDir,
    emptyOutDir: false,
    // 压缩交给下面的 terser 显式处理（Vite 的 minify 在 lib+es 下没生效）
    minify: false,
    lib: {
      entry,
      formats: ['es'],
      fileName: () => 'echarts.bundle.js',
    },
  },
});

if (!fs.existsSync(outFile)) {
  console.error(`打包结束但没找到产物：${outFile}`);
  process.exit(1);
}
const rawSize = fs.statSync(outFile).size;
console.log(`[2/3] 打包完成（未压缩 ${(rawSize / 1024).toFixed(0)} KB），开始 terser 压缩...`);

const code = fs.readFileSync(outFile, 'utf8');
const result = await minify(code, {
  // ESM 产物：必须显式开启 toplevel + module，terser 才会混淆顶层变量名
  module: true,
  mangle: { toplevel: true },
  compress: { drop_console: true, passes: 2 },
  format: { comments: false },
});

if (!result.code) {
  console.error('terser 没有产出内容，压缩失败');
  process.exit(1);
}
fs.writeFileSync(outFile, result.code, 'utf8');

const size = fs.statSync(outFile).size;
console.log(`[3/3] 完成：${path.relative(root, outFile)}（${(size / 1024).toFixed(0)} KB）`);
console.log("      产物是 ESM 格式，导入方式：import echarts from './echarts.bundle.js'");
console.log('      主包不再包含 echarts；分包页首次进入时才会下载这一份。');
