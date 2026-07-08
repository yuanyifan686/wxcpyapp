/**
 * Minimax AI 运势生成服务
 */
const config = require('../config/index.js')
const proxy = require('../utils/proxy.js')
const { today } = require('../utils/date.js')

const LEVEL_WEIGHTS = [
  { level: 'SSR', weight: 0.5 },
  { level: 'SR', weight: 0.1668 },
  { level: 'R', weight: 0.1668 },
  { level: 'N', weight: 0.1668 },
]

const LEVEL_SCORE_RANGE = {
  SSR: [88, 100],
  SR: [72, 87],
  R: [55, 71],
  N: [35, 54],
}

const SYSTEM_PROMPT = [
  '你是《今日赛博运势》AI，为年轻人生成赛博朋克风格的娱乐运势。',
  '风格：幽默、打工人梗、互联网语感、科技感，禁止传统算命黄历话术。',
  '重要：level 和 score 由系统预先指定，你必须原样写入 JSON，不得修改。',
  '根据指定等级撰写匹配的 summary、fortune、oneLine、title、keywords、buff、avoid 等文案。',
  '必须只返回合法 JSON，不要 markdown，不要解释。',
  'JSON 格式：',
  '{"level":"SSR|SR|R|N","score":0-100,"fishIndex":0-100,"bossRisk":0-100,',
  '"summary":"今日总结","fortune":"运势建议","oneLine":"毒鸡汤",',
  '"keywords":["词1","词2","词3"],',
  '"buff":{"color":"","number":0,"emoji":"","drink":"","food":"","city":"","song":"",',
  '"direction":"","time":"","weather":"","career":"","food":"","pet":""},',
  '"avoid":["避雷1","避雷2","避雷3"],"title":"今日成就称号"}',
].join('')

const RETRY_COUNT = 2
const TIMEOUT_MS = 30000

function rollLevel() {
  const r = Math.random()
  let acc = 0
  for (let i = 0; i < LEVEL_WEIGHTS.length; i++) {
    acc += LEVEL_WEIGHTS[i].weight
    if (r < acc) return LEVEL_WEIGHTS[i].level
  }
  return 'N'
}

function rollScoreForLevel(level) {
  const range = LEVEL_SCORE_RANGE[level] || LEVEL_SCORE_RANGE.R
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1))
}

function buildUserPrompt(rolledLevel, rolledScore) {
  const range = LEVEL_SCORE_RANGE[rolledLevel]
  const toneMap = {
    SSR: '欧皇附体、天降好运、诸事顺遂',
    SR: '运势不错、小有惊喜、稳中求进',
    R: '平平无奇、打工人日常、靠实力吃饭',
    N: '略带倒霉、自嘲幽默、小心踩坑',
  }
  const tone = toneMap[rolledLevel] || ''

  return [
    '请为 ' + today() + ' 生成一份赛博打工人今日运势 JSON。',
    '系统已锁定：level 必须为 "' + rolledLevel + '"，score 必须为 ' + rolledScore + '。',
    '幸运值允许范围 ' + range[0] + '-' + range[1] + '，请使用指定 score。',
    '文案气质：' + tone + '。内容要有创意和梗，title 称号要贴合等级。',
  ].join('')
}

function requestMinimax(messages) {
  if (proxy.useProxy()) {
    return proxy.proxyRequest('/minimax', 'POST', {
      model: config.minimax.model,
      messages,
      temperature: 0.95,
      max_tokens: 1024,
    })
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: config.minimax.baseUrl + '/text/chatcompletion_v2',
      method: 'POST',
      timeout: TIMEOUT_MS,
      header: {
        Authorization: 'Bearer ' + config.minimax.apiKey,
        'Content-Type': 'application/json',
      },
      data: {
        model: config.minimax.model,
        messages,
        temperature: 0.95,
        max_tokens: 1024,
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error('Minimax HTTP ' + res.statusCode))
        }
      },
      fail: reject,
    })
  })
}

function extractContent(response) {
  const choices = response.choices || response.reply || []
  if (Array.isArray(choices) && choices.length) {
    const item = choices[0]
    if (item.message && item.message.content) return item.message.content
    if (item.content) return item.content
  }
  if (response.reply && typeof response.reply === 'string') return response.reply
  if (response.output && response.output.text) return response.output.text
  throw new Error('Minimax 响应格式异常')
}

function parseFortuneJson(text, preset) {
  let raw = text.trim()
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) raw = codeBlock[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1)
  const data = JSON.parse(raw)
  return normalizeFortune(data, preset)
}

function clampScore(n, fallback) {
  const v = Number(n)
  if (isNaN(v)) return fallback
  return Math.max(0, Math.min(100, Math.round(v)))
}

function clampScoreToLevel(score, level) {
  const range = LEVEL_SCORE_RANGE[level] || LEVEL_SCORE_RANGE.R
  return Math.max(range[0], Math.min(range[1], clampScore(score, range[0])))
}

function normalizeFortune(data, preset) {
  const buff = data.buff || {}
  const level = (preset && preset.level) || data.level || 'R'
  const score = preset
    ? preset.score
    : clampScoreToLevel(data.score, level)

  return {
    level,
    score,
    fishIndex: Number(data.fishIndex) || 70,
    bossRisk: Number(data.bossRisk) || 50,
    summary: data.summary || '今天宇宙信号满格，适合主动出击。',
    fortune: data.fortune || '保持松弛感，好运会自动找上门。',
    oneLine: data.oneLine || '今天不是你不行，是 WiFi 在搞你心态。',
    keywords: Array.isArray(data.keywords) ? data.keywords : ['好运', '成长', '突破'],
    buff: {
      color: buff.color || '紫色',
      number: buff.number || 7,
      emoji: buff.emoji || '✨',
      drink: buff.drink || '冰美式',
      food: buff.food || '炸鸡',
      city: buff.city || '上海',
      song: buff.song || 'Counting Stars',
      direction: buff.direction || '东南',
      time: buff.time || '15:00',
      weather: buff.weather || '晴',
      career: buff.career || '程序员',
      pet: buff.pet || '猫',
    },
    avoid: Array.isArray(data.avoid) ? data.avoid : ['熬夜', '内耗', '冲动消费'],
    title: data.title || '幸运NPC',
  }
}

function mockFortune(preset) {
  const level = (preset && preset.level) || rollLevel()
  const score = (preset && preset.score) || rollScoreForLevel(level)
  const titles = {
    SSR: ['SSR人类', '欧皇附体', '天选打工人', '宇宙宠儿'],
    SR: ['摸鱼大师', 'Bug猎人', '卷王觉醒'],
    R: ['幸运NPC', '社畜本畜', '打工仙人'],
    N: ['非酋体验卡', '水逆幸存者', '摆烂艺术家'],
  }
  const pool = titles[level] || titles.R
  return normalizeFortune({
    level,
    score,
    fishIndex: 60 + Math.floor(Math.random() * 35),
    bossRisk: 30 + Math.floor(Math.random() * 50),
    summary: '今天非常适合开启新的挑战，主动出击将获得不错反馈。',
    fortune: '适合学习、面试、写代码、表白、发朋友圈。',
    oneLine: '你的代码没问题，是世界的问题。',
    keywords: ['好运', '突破', '成长'],
    buff: {
      color: '蓝色', number: 7, emoji: '🚀', drink: '冰美式', food: '炸鸡',
      city: '上海', song: 'Counting Stars', direction: '东南', time: '14:00',
      weather: '晴', career: '程序员', pet: '猫',
    },
    avoid: ['熬夜', '冲动消费', '迟到'],
    title: pool[Math.floor(Math.random() * pool.length)],
  }, { level, score })
}

function generateFortune(useMock) {
  const rolledLevel = rollLevel()
  const rolledScore = rollScoreForLevel(rolledLevel)
  const preset = { level: rolledLevel, score: rolledScore }

  if (useMock) {
    return Promise.resolve(mockFortune(preset))
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(rolledLevel, rolledScore) },
  ]

  function attempt(left) {
    return requestMinimax(messages)
      .then(extractContent)
      .then((content) => parseFortuneJson(content, preset))
      .catch((err) => {
        if (left > 0) return attempt(left - 1)
        console.warn('Minimax 失败，使用本地 mock', err)
        return mockFortune(preset)
      })
  }

  return attempt(RETRY_COUNT)
}

module.exports = {
  generateFortune,
  mockFortune,
  normalizeFortune,
  rollLevel,
  rollScoreForLevel,
}