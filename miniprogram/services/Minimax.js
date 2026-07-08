/**
 * Minimax AI 运势生成服务
 */
const config = require('../config/index.js')
const { today } = require('../utils/date.js')

const SYSTEM_PROMPT = [
  '你是《今日赛博运势》AI，为年轻人生成赛博朋克风格的娱乐运势。',
  '风格：幽默、打工人梗、互联网语感、科技感，禁止传统算命黄历话术。',
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

function buildUserPrompt() {
  const date = today()
  return '请为 ' + date + ' 生成一份全新的赛博打工人今日运势 JSON。level 按概率：SSR 10%, SR 25%, R 40%, N 25%。内容要有创意和梗。'
}

function requestMinimax(messages) {
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

function parseFortuneJson(text) {
  let raw = text.trim()
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) raw = codeBlock[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1)
  const data = JSON.parse(raw)
  return normalizeFortune(data)
}

function clampScore(n, fallback) {
  const v = Number(n)
  if (isNaN(v)) return fallback
  return Math.max(0, Math.min(100, Math.round(v)))
}

function normalizeFortune(data) {
  const buff = data.buff || {}
  const level = data.level || 'R'
  return {
    level,
    score: clampScore(data.score, 70),
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

function mockFortune() {
  const levels = ['SSR', 'SR', 'R', 'N']
  const titles = ['SSR人类', '摸鱼大师', 'Bug猎人', '卷王觉醒', '欧皇附体', '幸运NPC']
  const level = levels[Math.floor(Math.random() * levels.length)]
  const score = level === 'SSR' ? 88 + Math.floor(Math.random() * 12) : 55 + Math.floor(Math.random() * 35)
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
    title: titles[Math.floor(Math.random() * titles.length)],
  })
}

function generateFortune(useMock) {
  if (useMock) {
    return Promise.resolve(mockFortune())
  }
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt() },
  ]

  function attempt(left) {
    return requestMinimax(messages)
      .then(extractContent)
      .then(parseFortuneJson)
      .catch((err) => {
        if (left > 0) return attempt(left - 1)
        console.warn('Minimax 失败，使用本地 mock', err)
        return mockFortune()
      })
  }

  return attempt(RETRY_COUNT)
}

module.exports = {
  generateFortune,
  mockFortune,
  normalizeFortune,
}