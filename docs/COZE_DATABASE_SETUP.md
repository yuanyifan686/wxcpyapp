# Coze 数据库建表清单

> 《今日赛博运势》云端数据表设计  
> 按 PRD 功能反推，共 **2 张必建表 + 1 张可选表**

---

## ⚠️ Coze API 术语说明（重要）

根据 [Coze 官方文档](https://docs.coze.cn/developer_guides_create_coze_database)：

| 我们说的 | Coze API 实际叫法 |
|---------|------------------|
| 一张数据表 | 一个「扣子数据库」 |
| 表 ID | `database_id`（每张表独立一个 ID） |
| Collection ID | **不存在此概念** |

也就是说：**不是「1 个 Database 里建多张表」，而是每张表各自有一个 `database_id`。**

### 建表方式（二选一）

**方式 A：API 自动建表（推荐）**

```
POST https://api.coze.cn/v1/databases
需要：Token + workspace_id + table_name + fields
返回：新的 database_id（即这张表的 ID）
```

**方式 B：控制台手动建表**

在 Coze 控制台建表后，复制每张表的 `database_id` 即可。

### 你已有的 ID

`7644375062434840610` = **某一张已存在数据表的 database_id**，不是「容器 ID」。  
我们还需要为 `fortune_records` 和 `users` 各拿到一个 `database_id`（新建或复用）。

---

## 一、需要创建的资源

| 序号 | 表名 `table_name` | 用途 | 是否必建 | 对应 config 键 |
|------|-------------------|------|---------|---------------|
| 1 | `fortune_records` | 每日运势、历史记录、今日欧皇榜 | ✅ 必建 | `collections.fortuneRecords` |
| 2 | `users` | 个人中心、SSR 统计、签到积分 | ✅ 必建 | `collections.users` |
| 3 | `check_ins` | 签到流水明细 | 可选 | `collections.checkIns` |

建好后需提供：

```
workspace_id:                          ____________________（API 建表需要）
fortune_records 的 database_id:       ____________________
users 的 database_id:                 ____________________
check_ins 的 database_id:             ____________________（可选）
Coze API Token:                       已配置 ✅
```

---

## 二、表 1：`fortune_records`（运势记录表）

### 2.1 字段清单

| 序号 | 字段名（英文） | 中文名 | Coze 类型 | 必填 | 说明 |
|------|---------------|--------|----------|------|------|
| 1 | `openid` | 用户标识 | 文本 | ✅ | 微信 openid 或开发期临时 userId |
| 2 | `nickname` | 昵称 | 文本 | ✅ | 写入时快照，排行榜展示 |
| 3 | `avatar_url` | 头像 | 文本 | | 头像 URL 快照 |
| 4 | `fortune_date` | 运势日期 | 文本 | ✅ | 格式 `YYYY-MM-DD`，如 `2026-07-08` |
| 5 | `level` | 幸运等级 | 文本 | ✅ | `SSR` / `SR` / `R` / `N` |
| 6 | `score` | 幸运值 | 数字 | ✅ | 0–100，排行榜排序字段 |
| 7 | `fish_index` | 摸鱼指数 | 数字 | ✅ | 对应「赛博能量条」百分比 |
| 8 | `boss_risk` | 老板风险 | 数字 | ✅ | 0–100 |
| 9 | `summary` | 今日总结 | 文本 | ✅ | AI 生成的一句话总结 |
| 10 | `fortune` | 运势正文 | 文本 | ✅ | 适合做什么、行动建议 |
| 11 | `one_line` | AI 毒鸡汤 | 文本 | ✅ | 每日一句幽默梗 |
| 12 | `keywords` | 关键词 | 文本 | ✅ | JSON 数组字符串 |
| 13 | `buff` | 今日 BUFF | 文本 | ✅ | JSON 对象字符串 |
| 14 | `avoid` | 今日避雷 | 文本 | ✅ | JSON 数组字符串 |
| 15 | `title` | 今日成就 | 文本 | ✅ | 如 `SSR人类`、`摸鱼大师` |
| 16 | `is_official` | 是否正式签 | 数字 | ✅ | `1` = 当日正式签，`0` = 娱乐重抽 |
| 17 | `raw_data` | 原始数据 | 文本 | | Minimax 返回的完整 JSON 备份 |
| 18 | `created_at` | 创建时间 | 文本 | ✅ | 毫秒时间戳，如 `1720416000000` |

### 2.2 `buff` 字段 JSON 结构

```json
{
  "color": "蓝色",
  "number": 7,
  "emoji": "🚀",
  "drink": "冰美式",
  "song": "Counting Stars",
  "direction": "东南",
  "time": "14:00",
  "weather": "晴",
  "career": "程序员",
  "food": "炸鸡",
  "pet": "猫",
  "city": "上海"
}
```

### 2.3 示例数据（1 条正式签）

| 字段 | 示例值 |
|------|--------|
| openid | `oXxXx_test_user_001` |
| nickname | `赛博打工人` |
| avatar_url | `https://thirdwx.qlogo.cn/mmopen/xxx/132` |
| fortune_date | `2026-07-08` |
| level | `SSR` |
| score | `92` |
| fish_index | `88` |
| boss_risk | `63` |
| summary | `今天非常适合开启新的挑战，主动出击将获得不错反馈。` |
| fortune | `适合学习、面试、写代码、表白、发朋友圈。` |
| one_line | `你的代码没问题，是世界的问题。` |
| keywords | `["好运","突破","成长"]` |
| buff | `{"color":"蓝色","number":7,"emoji":"🚀","drink":"冰美式","song":"Counting Stars","direction":"东南","time":"14:00","weather":"晴","career":"程序员","food":"炸鸡","pet":"猫","city":"上海"}` |
| avoid | `["熬夜","冲动消费","迟到"]` |
| title | `SSR人类` |
| is_official | `1` |
| raw_data | `{"level":"SSR","score":92,"fishIndex":88,"bossRisk":63,...}` |
| created_at | `1720416000000` |

### 2.4 业务规则

| 场景 | 查询条件 |
|------|---------|
| 今日是否已正式抽签 | `openid` + `fortune_date=今天` + `is_official=1` |
| 历史 30 天 | `openid` + `is_official=1`，按 `fortune_date` 倒序取 30 条 |
| 今日欧皇榜 TOP100 | `fortune_date=今天` + `is_official=1`，按 `score` 降序取 100 条 |
| 娱乐重抽 | `is_official=0`，不计入排行榜与历史正式记录 |

---

## 三、表 2：`users`（用户统计表）

### 3.1 字段清单

| 序号 | 字段名（英文） | 中文名 | Coze 类型 | 必填 | 说明 |
|------|---------------|--------|----------|------|------|
| 1 | `openid` | 用户标识 | 文本 | ✅ | 主键，与运势表关联 |
| 2 | `nickname` | 昵称 | 文本 | ✅ | 当前昵称 |
| 3 | `avatar_url` | 头像 | 文本 | | 当前头像 URL |
| 4 | `total_draws` | 累计抽签 | 数字 | ✅ | 含正式签 + 娱乐重抽 |
| 5 | `official_draws` | 正式签次数 | 数字 | ✅ | 仅 `is_official=1` 的次数 |
| 6 | `max_score` | 最高幸运值 | 数字 | ✅ | 历史最高 `score` |
| 7 | `avg_score` | 平均幸运值 | 数字 | ✅ | 所有正式签 `score` 平均值 |
| 8 | `ssr_count` | SSR 次数 | 数字 | ✅ | 排行榜「SSR 次数」展示 |
| 9 | `check_in_streak` | 连续签到天数 | 数字 | ✅ | 当前连续签到 |
| 10 | `max_check_in_streak` | 最长连续签到 | 数字 | | 历史最长记录 |
| 11 | `total_check_in` | 累计签到天数 | 数字 | ✅ | 总签到天数 |
| 12 | `last_check_in_date` | 上次签到日期 | 文本 | | `YYYY-MM-DD` |
| 13 | `points` | 积分 | 数字 | ✅ | 签到里程碑累计积分 |
| 14 | `badges` | 已获得徽章 | 文本 | ✅ | JSON 数组字符串 |
| 15 | `created_at` | 注册时间 | 文本 | ✅ | 毫秒时间戳 |
| 16 | `updated_at` | 更新时间 | 文本 | ✅ | 毫秒时间戳 |

### 3.2 示例数据（1 条用户）

| 字段 | 示例值 |
|------|--------|
| openid | `oXxXx_test_user_001` |
| nickname | `赛博打工人` |
| avatar_url | `https://thirdwx.qlogo.cn/mmopen/xxx/132` |
| total_draws | `15` |
| official_draws | `12` |
| max_score | `96` |
| avg_score | `78` |
| ssr_count | `3` |
| check_in_streak | `7` |
| max_check_in_streak | `14` |
| total_check_in | `30` |
| last_check_in_date | `2026-07-08` |
| points | `160` |
| badges | `["7日签到","Bug猎人"]` |
| created_at | `1718000000000` |
| updated_at | `1720416000000` |

### 3.3 签到里程碑奖励规则

| 连续天数 | 积分奖励 | 徽章 |
|---------|---------|------|
| 1 天 | +10 | — |
| 7 天 | +50 | `7日签到` |
| 30 天 | +200 | `30日签到` |
| 365 天 | +1000 | `365日签到` |

---

## 四、表 3：`check_ins`（签到流水表，可选）

> 若只需显示「签到天数」和「徽章」，**表 2 已足够**，可不建此表。

### 4.1 字段清单

| 序号 | 字段名（英文） | 中文名 | Coze 类型 | 必填 | 说明 |
|------|---------------|--------|----------|------|------|
| 1 | `openid` | 用户标识 | 文本 | ✅ | |
| 2 | `check_in_date` | 签到日期 | 文本 | ✅ | `YYYY-MM-DD` |
| 3 | `streak_day` | 连续第几天 | 数字 | ✅ | 如第 7 天连续签到填 `7` |
| 4 | `points_earned` | 本次积分 | 数字 | | 本次签到获得的积分 |
| 5 | `badge_earned` | 本次徽章 | 文本 | | 无则留空 |
| 6 | `created_at` | 签到时间 | 文本 | ✅ | 毫秒时间戳 |

### 4.2 示例数据

| 字段 | 示例值 |
|------|--------|
| openid | `oXxXx_test_user_001` |
| check_in_date | `2026-07-08` |
| streak_day | `7` |
| points_earned | `50` |
| badge_earned | `7日签到` |
| created_at | `1720416000000` |

---

## 五、Coze 控制台操作步骤

### Step 1：创建 Database

1. 登录 [Coze 控制台](https://www.coze.cn)
2. 进入你的 Bot / 项目
3. 找到 **数据库（Database）** 功能
4. 新建数据库，命名建议：`cyber_fortune`

### Step 2：创建 Collection `fortune_records`

1. 在数据库内新建数据表
2. 表名：`fortune_records`
3. 按 **第二节 2.1** 逐个添加字段
4. 数字字段选「数字」，其余选「文本」
5. 可先手动插入 **第二节 2.3** 的示例数据验证

### Step 3：创建 Collection `users`

1. 新建数据表，表名：`users`
2. 按 **第三节 3.1** 添加字段
3. 插入 **第三节 3.2** 示例数据验证

### Step 4：（可选）创建 Collection `check_ins`

1. 新建数据表，表名：`check_ins`
2. 按 **第四节 4.1** 添加字段

### Step 5：复制 ID

每张表各自有一个 **`database_id`**（在表详情或 API 页面查看）。

若用 API 建表，还需提供 **`workspace_id`**（工作空间 ID，可在「查看工作空间列表」接口获取）。

---

## 六、字段与 PRD 功能对照

```
PRD 功能                    数据来源
─────────────────────────────────────────────
首页抽签 → 结果页            fortune_records（写入）
每日限 1 次 + 娱乐重抽       fortune_records.is_official
历史记录（30 天）            fortune_records（openid 查询）
今日欧皇榜 TOP100            fortune_records（今日 score 排序）
排行榜 SSR 次数              users.ssr_count
赛博能量条                   fortune_records.fish_index
今日 BUFF                    fortune_records.buff
今日避雷                     fortune_records.avoid
AI 毒鸡汤                    fortune_records.one_line
今日成就 / 徽章              fortune_records.title + level
分享海报                     fortune_records + users（读取）
个人中心统计                 users
连续签到 / 积分 / 徽章       users（+ 可选 check_ins）
```

---

## 七、开发侧配置映射

建表完成后，`miniprogram/config/index.js` 将填入：

```javascript
module.exports = {
  coze: {
    token: 'pat_xxx',           // 已配置
    workspaceId: '填 workspace_id',  // API 建表时需要
    collections: {
      fortuneRecords: '填 fortune_records 表的 database_id',
      users: '填 users 表的 database_id',
      checkIns: '填 check_ins 表的 database_id（可选）',
    },
    baseUrl: 'https://api.coze.cn/v1',
  },
  // ...
}
```

---

## 八、快速核对清单

建表前请确认：

- [ ] Database 已创建
- [ ] `fortune_records` 表 18 个字段已添加
- [ ] `users` 表 16 个字段已添加
- [ ] （可选）`check_ins` 表 6 个字段已添加
- [ ] 每张表已插入 1 条示例数据测试
- [ ] 已复制 Database ID 和各 Collection ID
- [ ] API Token 有读写数据库权限

全部完成后，把 ID 发给开发即可开始对接 `services/coze.js`。