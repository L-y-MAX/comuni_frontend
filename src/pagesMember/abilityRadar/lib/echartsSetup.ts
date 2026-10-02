/**
 * 小程序端 ECharts 按需装配
 *
 * ## 为什么要按需装配
 *
 * 直接 `import * as echarts from 'echarts'` 会把**全部图表与组件**打进主包
 * （完整包 1MB 左右）。能力画像页在主包里，这一下就能把主包从 0.49MB 顶到 1.5MB，
 * 首页启动也会跟着变慢。
 *
 * 这里只注册本图真正用到的东西，其余一律不打包：
 *   - RadarChart        雷达系列（series[0] 的轮廓与面积填充）
 *   - ScatterChart      散点系列（series[1] 的十颗顶点星球）
 *   - RadarComponent    雷达坐标系（indicator / splitLine / axisLine）
 *   - PolarComponent    极坐标系（承载星球图标的定位载体）+ 它的角度轴/半径轴
 *   - TooltipComponent  点击星球后的浮层
 *   - CanvasRenderer    小程序端渲染器
 *
 * ## 用法
 *
 * 组件不会自己 import echarts，而是通过 provide/inject 拿，
 * 所以页面里必须显式注册（见 abilityRadar.vue 的 provideEcharts 调用）。
 */
import * as echarts from 'echarts/core';
import { RadarChart, ScatterChart } from 'echarts/charts';
import { PolarComponent, RadarComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  RadarChart,
  ScatterChart,
  RadarComponent,
  PolarComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export default echarts;
