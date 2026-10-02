/**
 * 预打包 echarts 的入口文件（供 scripts/build-echarts-bundle.mjs 使用）
 *
 * 只注册本图真正用到的东西，其余一律不打包：
 *   RadarChart        雷达系列（series[0] 的轮廓与面积填充）
 *   ScatterChart      散点系列（series[1] 的十颗顶点星球）
 *   RadarComponent    雷达坐标系（indicator / splitLine / axisLine）
 *   PolarComponent    极坐标系（承载星球图标的定位载体）
 *   TooltipComponent  点击星球后的浮层
 *   CanvasRenderer    小程序端渲染器
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
