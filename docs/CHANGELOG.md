# 开发变更记录

本文档记录 `wxcpyapp` 项目中的所有开发改动，按时间倒序排列（最新在前）。

---

## 记录规范

每次改动需包含：日期、需求/目的、改动文件、改动内容、备注。

---

## 2026-07-08

### [优化] 欧皇榜显示 + 分数逻辑说明

**需求/目的：** 优化欧皇榜展示；用户询问幸运值分数如何生成。

**改动文件：**
- `services/fortune.js`、`services/Minimax.js`
- `pages/ranking/ranking.wxml`、`ranking.wxss`、`ranking.js`、`ranking.json`

**改动内容：**
- 欧皇榜合并云端 + 本地今日正式签（与历史页同思路）
- 新增统计条：参战人数 / 最高分 / 我的排名
- 等级色徽章、自己的条目高亮、1~2 人领奖台适配、空状态引导抽签
- `normalizeFortune` 增加 score 0-100 钳制

**分数机制：** 主路径 Minimax-M3 生成；失败时 mock 按等级区间随机（非纯 0-100 均匀随机）。

---

## 2026-07-08

### [修复] 历史记录始终为空

**需求/目的：** 用户反馈「近30天运势」一直显示暂无历史记录。

**改动文件：**
- `utils/storage.js`
- `services/fortune.js`
- `pages/history/history.js`

**改动内容：**
- 根因：历史页只查 Coze；抽签若云端写入失败，仅缓存「今日运势」，未进历史列表
- 新增本地历史存储 `cyber_fortune_history`（最多 30 条正式签）
- 抽签成功或降级时均写入本地历史
- `getHistory` 合并云端 + 本地记录；云端失败时回退本地
- 打开历史页时自动把「今日缓存」同步进历史

---

## 2026-07-08

### [配置] Minimax 模型切换为 Minimax-M3

**需求/目的：** 用户指定使用 Minimax-M3 模型生成运势。

**改动文件：**
- `miniprogram/config/index.js`
- `miniprogram/config/index.example.js`

**改动内容：**
- `model` 由 `abab6.5s-chat` 改为 `Minimax-M3`

---

## 2026-07-08

### [测试] 功能测试报告

**需求/目的：** 用户要求以测试工程师角色验证当前功能。

**改动文件：**
- 新增 `docs/TEST_REPORT.md`
- 新增 `tests/api-test.ps1`、`tests/static-check.ps1`

**改动内容：**
- 完成 API 自动化测试（Coze 增删查改、Minimax 调用）
- 完成 PRD 功能矩阵审查
- 记录 5 项缺陷（P1 重复用户、P2 云端未同步、P2 Minimax 解析等）

**备注：** UI 交互需在微信开发者工具人工复测。

---

## 2026-07-08

### [修复] 签到与用户更新 Coze API 调用错误

**需求/目的：** 用户反馈签到等功能不可用，排查并修复。

**改动文件：**
- `services/coze.js`
- `services/fortune.js`
- `pages/profile/profile.js`

**改动内容：**
- 修复 `updateUser` 误传数组导致 Coze 更新始终失败
- 签到支持无运势记录时自动创建用户条目
- 签到失败时展示更明确错误信息

**备注：** 云端表为空多因开发者工具未勾选「不校验合法域名」导致 Coze 写入失败；非部署问题。

---

## 2026-07-08

### [UI] 三项界面质感优化

**需求/目的：** 提升结果页仪式感、欧皇榜社交感、全局 TabBar 质感。

**改动文件：**
- `pages/result/result.wxml`、`result.wxss`、`result.js`
- `pages/ranking/ranking.wxml`、`ranking.wxss`、`ranking.js`
- `custom-tab-bar/index.wxml`、`index.wxss`、`index.js`
- `services/fortune.js`

**改动内容：**
1. **结果页**：8 段阶梯入场动画；幸运值渐变扫光；星级弹出；SSR 全屏金光 + 粒子 + 震动；等级徽章样式
2. **欧皇榜**：前三名领奖台布局（银-金-铜）；头像 + 分数 + SSR 次数；第 4 名起列表展示 SSR 统计
3. **TabBar**：CSS 线性图标替代 emoji；毛玻璃加强；顶部渐变高光线；选中发光效果

**备注：** 排行榜 SSR 次数从 `users` 表批量关联查询。

---

## 2026-07-08

### [开发] 按 PRD 完成《今日赛博运势》小程序 v1

**需求/目的：** 用户要求按 PRD 全文开发可运行的微信原生小程序。

**改动文件：**

*新增*
- `miniprogram/app.js`（替换 app.ts）
- `miniprogram/custom-tab-bar/`（自定义 TabBar）
- `miniprogram/services/coze.js`、`Minimax.js`、`fortune.js`
- `miniprogram/utils/date.js`、`storage.js`、`animation.js`
- `miniprogram/components/`：glass-button、loading-ball、fortune-card、energy-bar、tag-list、buff-grid、badge、share-poster
- `miniprogram/pages/home/`、`result/`、`history/`、`ranking/`、`profile/`
- `miniprogram/sitemap.json`

*修改*
- `miniprogram/app.json`、`app.wxss`
- `project.config.json`（移除 TS 插件，启用 ES6）

*删除*
- 旧模板：`pages/index/`、`pages/logs/`、`app.ts`、`utils/util.ts`

**改动内容：**

1. **首页**：赛博渐变背景、星空粒子、玻璃球点击动画（旋转/发光/震动/爆炸 2 秒）、每日限 1 次正式签 + 娱乐重抽
2. **结果页**：幸运指数星级、滚动数字、今日总结、BUFF 网格、避雷、毒鸡汤、成就徽章、赛博能量条、分享海报 Canvas
3. **历史页**：近 30 天时间轴，点击查看详情
4. **欧皇榜**：今日 TOP100 按幸运值排序
5. **个人中心**：头像昵称、统计数据、连续签到、徽章展示
6. **服务层**：Minimax AI 生成 JSON 运势（含重试/超时/mock 降级）；Coze 增删查改；业务编排 fortune.js
7. **设计**：Glass UI、暗黑模式、主题色变量、60FPS CSS 动画

**备注：**
- 微信开发者工具需勾选「不校验合法域名」进行本地调试
- 正式上线需在公众平台配置 `api.coze.cn`、`api.minimaxi.com`
- Token 权限需包含 Database 读写

---

## 2026-07-08

### [数据库] API 自动创建 Coze 数据表

**改动内容：**
- `fortune_records` → `7659972934710165538`
- `users` → `7659971574405218344`

---

## 2026-07-08

### [配置] 更正 workspace_id

**改动内容：** `workspaceId` = `7644375062434840610`

---

## 2026-07-08

### [文档] Coze 数据库建表清单

**改动文件：** 新增 `docs/COZE_DATABASE_SETUP.md`

---

## 2026-07-08

### [配置] 接收 API Key 并建立私密配置

**改动文件：** `.gitignore`、`miniprogram/config/index.js`、`index.example.js`

---

## 2026-07-08

### [初始化] 建立变更记录文档

**项目基线：** 微信 TS 快速启动模板 → 现已替换为赛博运势完整项目

---