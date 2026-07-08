# 今日赛博运势（Cyber Fortune）
> AI 驱动的赛博朋克娱乐微信小程序 PRD（Grok 开发版）

---

# 一、项目定位

开发一个微信原生小程序：

# 《今日赛博运势》

产品定位：

AI 娱乐工具

不是算命

不是黄历

不是玄学

而是：

> 用 AI 生成年轻人的「赛博打工人今日运势」，具有娱乐、分享、截图传播属性。

目标用户：

18~35 岁

- 学生
- 程序员
- 打工人
- AI爱好者
- 二次元用户

核心目标：

- 每天打开一次
- AI生成今日运势
- 截图分享朋友圈
- 分享微信群
- 社交传播

产品关键词：

Cyberpunk

Glassmorphism

Apple Design

Discord

Arc Browser

TikTok

Notion

Liquid Glass

2026互联网产品设计

---

# 二、开发要求（必须遵守）

必须使用：

微信原生小程序

WXML

WXSS

JavaScript（ES6）

组件化开发

目录规范

支持暗黑模式

60FPS动画

代码真实可运行

确保：

可以直接导入微信开发者工具运行。

同时保证：

可以迁移至 HBuilderX。

不要写伪代码。

不要省略代码。

不要 TODO。

所有代码必须完整。

---

# 三、技术栈

前端：

微信原生小程序

数据：

Coze Database

> 所有数据库操作均放在前端实现。

如果需要：

DatabaseID

CollectionID

Token

请暂停并询问用户。

AI：

Minimax

用于生成：

今日运势

今日总结

AI毒鸡汤

今日称号

今日BUFF

统一封装：

services/

Minimax.js

coze.js

---

# 四、产品风格

整体禁止：

❌ 黄历风

❌ 中国传统算命

❌ 红黄配色

❌ 财神

❌ 八卦

❌ 桃木

❌ 铜钱

整体采用：

Apple + Discord + Arc Browser + Glass UI

风格：

年轻化

科技感

赛博朋克

未来感

高级渐变

Glassmorphism

Liquid Glass

二次元

仪式感

社交传播

---

# 五、Design System

字体：

HarmonyOS Sans

MiSans

PingFang SC

图标：

Lucide Icons

圆角：

24px

阴影：

Glass Shadow

Blur：

20px

背景：

动态渐变

颜色：

Primary

#6C63FF

Secondary

#A855F7

Accent

#22D3EE

Success

#10B981

Warning

#F59E0B

Danger

#EF4444

背景：

黑色

蓝紫

粉紫

青色

玻璃质感

---

# 六、动画要求

首页：

动态渐变

星空粒子

漂浮光斑

呼吸动画

玻璃反光

按钮：

Liquid Button

Hover

Scale

点击：

震动反馈

球体：

旋转

发光

2秒粒子爆炸

数字：

滚动动画

页面：

Fade

Slide

Scale

卡片：

逐渐出现

全部保持：

60FPS

---

# 七、首页

全屏设计

顶部：

Logo

标题：

今日赛博运势

Slogan：

宇宙服务器今日已同步你的幸运值。

中间：

巨大玻璃球

内容：

✨ 点击获取今日运势

点击以后：

旋转

发光

震动

粒子爆炸

持续2秒

随后进入：

结果页

每天默认只能生成一次。

保留：

重新生成（娱乐模式）

---

# 八、结果页

顶部：

今日幸运指数

★★★★★

动态星星

幸运值：

92%

超大数字

AI生成：

今日总结

例如：

今天非常适合开启新的挑战。

主动出击将获得不错反馈。

适合：

✔ 学习

✔ 面试

✔ 写代码

✔ 表白

✔ 发朋友圈

✔ 买一张彩票（娱乐）

关键词：

Tag：

坚持

成长

突破

好运

连接

---

# 九、今日BUFF

Glass Card

Grid布局

随机：

幸运颜色

幸运数字

幸运Emoji

幸运饮料

幸运歌曲

幸运方向

幸运时间

幸运天气

幸运职业

幸运食物

幸运宠物

幸运城市

---

# 十、今日避雷

Glass Card

随机：

今天不建议：

熬夜

冲动消费

迟到

摸鱼

内耗

开会

写Bug

等等。

---

# 十一、赛博能量条

动画：

████████░░

Cyber Energy

82%

支持渐变动画。

---

# 十二、AI毒鸡汤

每日一句。

例如：

今天不是你不努力。

只是宇宙WiFi信号有点差。

要求：

互联网梗

打工人

幽默

可截图

---

# 十三、今日成就

每日随机：

Bug猎人

摸鱼大师

SSR人类

卷王觉醒

幸运NPC

欧皇附体

采用：

徽章设计

支持发光。

---

# 十四、分享海报

生成图片。

内容：

幸运值

SSR等级

一句总结

昵称

二维码位置

背景：

赛博朋克

Glass

高级渐变

适合：

朋友圈

微信群

小红书

微博

截图传播。

---

# 十五、历史记录

查看：

最近30天

时间轴

支持：

点击查看详情

数据来源：

Coze Database

---

# 十六、排行榜

今日欧皇榜

TOP100

显示：

昵称

幸运值

SSR次数

---

# 十七、连续签到

签到：

1天

7天

30天

365天

获得：

徽章

积分

---

# 十八、个人中心

头像

昵称

累计抽签

历史最高幸运值

平均幸运值

获得徽章

签到天数

---

# 十九、Minimax 输出格式

必须输出 JSON：

```json
{
  "level": "SSR",
  "score": 92,
  "fishIndex": 88,
  "bossRisk": 63,
  "summary": "今天适合摸鱼，不适合开会。",
  "fortune": "主动一点，会有意外收获。",
  "oneLine": "你的代码没问题，是世界的问题。",
  "keywords": [
    "好运",
    "突破",
    "成长"
  ],
  "buff": {
    "color": "蓝色",
    "number": 7,
    "emoji": "🚀",
    "drink": "冰美式",
    "food": "炸鸡",
    "city": "上海",
    "song": "Counting Stars"
  },
  "avoid": [
    "熬夜",
    "冲动消费",
    "迟到"
  ],
  "title": "SSR人类"
}
```

---

# 二十、目录结构

```
miniprogram/

pages/
home/
history/
profile/
ranking/

components/
fortune-card/
glass-button/
energy-bar/
tag-list/
buff-grid/
badge/
loading-ball/
share-poster/

services/
Minimax.js
coze.js

utils/
storage.js
animation.js
date.js

assets/
icons/
images/
lottie/

app.js
app.json
app.wxss
```

---

# 二十一、数据库（Coze）

所有数据库操作统一封装：

```
services/coze.js
```

需要配置：

Database ID

Collection ID

API Token

若缺少：

必须暂停询问用户。

---

# 二十二、AI接口

统一封装：

```
services/Minimax.js
```

负责：

发送Prompt

解析JSON

异常处理

重试

超时处理

---

# 二十三、性能要求

首屏：

<1.5秒

动画：

60FPS

图片：

懒加载

缓存：

本地缓存今日运势

避免重复请求。

---

# 二十四、代码规范

ES6

Promise

Async Await

组件化

禁止：

重复代码

魔法数字

硬编码

必须：

完整注释

统一命名

统一主题变量

---

# 二十五、最终验收（必须全部满足）

✅ 微信开发者工具可直接运行

✅ HBuilderX 可运行调试

✅ 无报错

✅ 首页动画正常

✅ 运势生成正常

✅ Minimax 返回 JSON 正常解析

✅ Coze 数据正常保存

✅ 历史记录正常

✅ 分享海报正常生成

✅ 暗黑模式正常

✅ Glass UI 完整

✅ 响应式适配主流手机

✅ 所有组件独立封装

✅ 页面切换动画正常

✅ UI 达到 2026 年互联网大厂产品水准

---

# 二十六、开发原则（最高优先级）

你是一名资深：

- 产品经理
- UI 设计师
- 全栈工程师
- 微信小程序架构师

目标不是生成 Demo。

而是生成：

> **一个可以直接运行、可上线、可维护、可扩展、具有互联网大厂质量的微信原生小程序项目。**

生成代码时：

- 不省略任何文件
- 不使用伪代码
- 不写 TODO
- 保证所有页面、组件、接口、动画均可直接运行
- 如果需要 Coze 配置（Database ID、Collection ID、Token）或 Minimax API Key，必须暂停并询问用户后再继续生成相关代码。