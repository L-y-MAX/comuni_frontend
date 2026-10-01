底部导航栏（tabBar）图标放在这个目录里，文件名与 src/pages.json 里的 iconPath 一一对应：

  首页       home_default.png     / home_selected.png
  能力画像    ability_default.png  / ability_selected.png
  AI 助手    ai_default.png       / ai_selected.png      <- 想换 AI 助手图标就替换这两个
  我的       user_default.png     / user_selected.png

规格要求：
  - 格式：PNG 或 JPG
  - 大小：40KB 以内（硬限制）
  - 尺寸：微信官方建议 81x81（当前项目里是 200x200，也能正常显示）
  - 未选中图标建议用中性灰，选中图标建议用主题色橙红 #ff4500
  - 背景建议透明

⚠️ 重要：微信会校验整个 tabBar。
   任何一项的图标文件找不到、或文件名与 iconPath 对不上，
   会导致【全部四个】图标都不显示，并在控制台报 checkTabbar 错误：
     app.json: ["tabBar"]["list"][n]["iconPath"]: "..." 未找到
   所以换图标前务必逐字符确认文件名（大小写、下划线、**不能有空格**）。

⚠️ 改完必须重新构建才会生效（npm run dev:mp-weixin）；
   另外请确认没有把文件误放进 dist/ 目录。

说明：knowledge_default.png / knowledge_selected.png 是历史遗留文件
（知识库原先在 tabBar 里，现已移到「我的」），当前 pages.json 已不再引用它们。
