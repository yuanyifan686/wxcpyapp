/**
 * 运势业务编排：AI 生成 + Coze 存储 + 用户统计
 */
const minimax = require('./Minimax.js')
const coze = require('./coze.js')
const proxy = require('../utils/proxy.js')
const storage = require('../utils/storage.js')
const { today, nowTimestamp } = require('../utils/date.js')

const RANKING_CACHE_TTL = 45000
let rankingCache = { date: '', items: null, updatedAt: 0 }

function buildRecord(fortune, userId, userInfo, isOfficial) {
  const date = today()
  return {
    openid: userId,
    nickname: userInfo.nickname || '赛博旅人',
    avatar_url: userInfo.avatarUrl || '',
    fortune_date: date,
    level: fortune.level,
    score: fortune.score,
    fish_index: fortune.fishIndex,
    boss_risk: fortune.bossRisk,
    summary: fortune.summary,
    fortune: fortune.fortune,
    one_line: fortune.oneLine,
    keywords: fortune.keywords,
    buff: fortune.buff,
    avoid: fortune.avoid,
    title: fortune.title,
    is_official: isOfficial ? 1 : 0,
    raw_data: fortune,
    created_at: nowTimestamp(),
  }
}

function parseRecord(item) {
  const parseJson = (v, fallback) => {
    if (!v) return fallback
    if (typeof v === 'object') return v
    try { return JSON.parse(v) } catch (e) { return fallback }
  }
  return {
    openid: item.openid,
    nickname: item.nickname || '赛博旅人',
    avatar_url: item.avatar_url || '',
    fortune_date: item.fortune_date,
    level: item.level,
    score: Number(item.score),
    fishIndex: Number(item.fish_index),
    bossRisk: Number(item.boss_risk),
    summary: item.summary,
    fortune: item.fortune,
    oneLine: item.one_line,
    keywords: parseJson(item.keywords, []),
    buff: parseJson(item.buff, {}),
    avoid: parseJson(item.avoid, []),
    title: item.title,
    is_official: Number(item.is_official),
  }
}

function checkTodayOfficial(userId) {
  const cached = storage.getCachedTodayFortune(today())
  if (cached && cached.is_official) {
    storage.appendFortuneHistory(cached)
    return Promise.resolve(cached)
  }

  return coze.queryFortuneByUserAndDate(userId, today())
    .then((data) => {
      const items = (data && data.items) || []
      if (items.length) {
        const record = parseRecord(items[0])
        storage.cacheTodayFortune(record)
        storage.appendFortuneHistory(record)
        return record
      }
      return null
    })
    .catch(() => null)
}

function updateUserStats(userId, userInfo, fortune, isOfficial) {
  return coze.queryUser(userId)
    .then((data) => {
      const items = (data && data.items) || []
      const now = nowTimestamp()
      let user

      if (items.length) {
        const u = items[0]
        const total = Number(u.total_draws || 0) + 1
        const official = Number(u.official_draws || 0) + (isOfficial ? 1 : 0)
        const maxScore = Math.max(Number(u.max_score || 0), fortune.score)
        const prevAvg = Number(u.avg_score || 0)
        const prevOfficial = Number(u.official_draws || 0)
        const avgScore = isOfficial
          ? Math.round(((prevAvg * prevOfficial) + fortune.score) / official)
          : prevAvg
        const ssrCount = Number(u.ssr_count || 0) + (fortune.level === 'SSR' && isOfficial ? 1 : 0)
        let badges = []
        try { badges = JSON.parse(u.badges || '[]') } catch (e) { badges = [] }
        if (isOfficial && fortune.title && badges.indexOf(fortune.title) < 0) {
          badges.push(fortune.title)
        }
        user = {
          openid: userId,
          nickname: userInfo.nickname || u.nickname,
          avatar_url: userInfo.avatarUrl || u.avatar_url || '',
          total_draws: total,
          official_draws: official,
          max_score: maxScore,
          avg_score: avgScore,
          ssr_count: ssrCount,
          check_in_streak: Number(u.check_in_streak || 0),
          max_check_in_streak: Number(u.max_check_in_streak || 0),
          total_check_in: Number(u.total_check_in || 0),
          last_check_in_date: u.last_check_in_date || '',
          points: Number(u.points || 0),
          badges: badges,
          created_at: u.created_at || now,
          updated_at: now,
        }
        return coze.updateUser(user)
      }

      user = {
        openid: userId,
        nickname: userInfo.nickname || '赛博旅人',
        avatar_url: userInfo.avatarUrl || '',
        total_draws: 1,
        official_draws: isOfficial ? 1 : 0,
        max_score: fortune.score,
        avg_score: fortune.score,
        ssr_count: fortune.level === 'SSR' && isOfficial ? 1 : 0,
        check_in_streak: 0,
        max_check_in_streak: 0,
        total_check_in: 0,
        last_check_in_date: '',
        points: 0,
        badges: isOfficial && fortune.title ? [fortune.title] : [],
        created_at: now,
        updated_at: now,
      }
      return coze.insertUser(user)
    })
    .catch((err) => {
      console.warn('更新用户统计失败', err)
    })
}

function generateAndSave(isEntertainment) {
  const app = getApp()
  const userId = app.globalData.userId || storage.getUserId()
  const userInfo = app.globalData.userInfo || storage.getUserInfo()
  const isOfficial = !isEntertainment

  return checkTodayOfficial(userId).then((existing) => {
    if (isOfficial && existing) {
      return existing
    }

    return minimax.generateFortune(false).then((fortune) => {
      const record = buildRecord(fortune, userId, userInfo, isOfficial)
      const parsed = parseRecord(record)

      return coze.insertFortuneRecord(record)
        .then(() => updateUserStats(userId, userInfo, fortune, isOfficial))
        .then(() => {
          if (isOfficial) {
            storage.cacheTodayFortune(parsed)
            storage.appendFortuneHistory(parsed)
            invalidateRankingCache()
          }
          app.setCurrentFortune(parsed)
          return parsed
        })
        .catch((err) => {
          console.warn('Coze 保存失败，使用本地缓存', err)
          if (isOfficial) {
            storage.cacheTodayFortune(parsed)
            storage.appendFortuneHistory(parsed)
            invalidateRankingCache()
          }
          app.setCurrentFortune(parsed)
          return parsed
        })
    })
  })
}

function getHistory(userId) {
  const localList = storage.getLocalHistory()
  const cachedToday = storage.getCachedTodayFortune(today())
  if (cachedToday && cachedToday.is_official) {
    storage.appendFortuneHistory(cachedToday)
  }

  return coze.queryFortuneHistory(userId, 30)
    .then((data) => {
      const cloudList = ((data && data.items) || []).map(parseRecord)
      return storage.mergeHistoryRecords(cloudList, storage.getLocalHistory())
    })
    .catch((err) => {
      console.warn('Coze 历史查询失败，使用本地记录', err)
      return storage.getLocalHistory()
    })
}

function getUsersSsrMapForOpenids(openids) {
  const ids = (openids || []).filter(Boolean)
  if (!ids.length) return Promise.resolve({})

  return coze.queryUsersByOpenids(ids)
    .then((data) => {
      const map = {}
      ;((data && data.items) || []).forEach((u) => {
        map[u.openid] = Number(u.ssr_count || 0)
      })
      return map
    })
    .catch(() => ({}))
}

function getLocalRankingRecords(date) {
  const userId = getApp().globalData.userId || storage.getUserId()
  const userInfo = getApp().globalData.userInfo || storage.getUserInfo()
  const cached = date === today() ? storage.getCachedTodayFortune(date) : null
  const fromHistory = storage.getLocalHistory().filter(
    (item) => item.fortune_date === date && item.is_official
  )
  const map = {}
  const enrich = (item) => ({
    ...item,
    openid: item.openid || userId,
    nickname: item.nickname || userInfo.nickname || '赛博旅人',
    avatar_url: item.avatar_url || userInfo.avatarUrl || '',
  })
  fromHistory.forEach((item) => {
    const r = enrich(item)
    map[r.openid] = r
  })
  if (cached && cached.is_official) {
    const r = enrich(cached)
    if (!map[r.openid] || map[r.openid].score < r.score) map[r.openid] = r
  }
  return Object.keys(map).map((k) => map[k])
}

function mergeRankingList(cloudList, localList, ssrMap) {
  const map = {}
  const put = (item) => {
    if (!item) return
    const key = item.openid || item.nickname || ('anon_' + item.score)
    const prev = map[key]
    if (!prev || Number(item.score) > Number(prev.score)) map[key] = item
  }
  localList.forEach(put)
  cloudList.forEach(put)
  return Object.keys(map)
    .map((k) => {
      const record = map[k]
      return {
        ...record,
        ssrCount: (ssrMap && ssrMap[record.openid])
          ?? record.ssrCount
          ?? (record.level === 'SSR' ? 1 : 0),
      }
    })
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 100)
}

function fetchCloudRanking(date) {
  if (proxy.useProxy()) {
    return proxy.proxyRequest('/ranking?date=' + date, 'GET', null)
      .then((data) => ((data && data.items) || []))
  }

  return coze.queryRankingByDate(date, 100).then((rankData) => {
    const cloudList = ((rankData && rankData.items) || []).map(parseRecord)
    const openids = cloudList.map((item) => item.openid).filter(Boolean)
    return getUsersSsrMapForOpenids(openids).then((ssrMap) =>
      mergeRankingList(cloudList, [], ssrMap)
    )
  })
}

function getRanking(options) {
  const force = options && options.force
  const date = (options && options.date) || today()
  const localRecords = getLocalRankingRecords(date)
  const now = Date.now()

  if (
    !force
    && rankingCache.date === date
    && rankingCache.items
    && now - rankingCache.updatedAt < RANKING_CACHE_TTL
  ) {
    return Promise.resolve(mergeRankingList(rankingCache.items, localRecords, {}))
  }

  return fetchCloudRanking(date)
    .then((cloudItems) => {
      const merged = mergeRankingList(cloudItems, localRecords, {})
      rankingCache = { date, items: cloudItems, updatedAt: Date.now() }
      return merged
    })
    .catch((err) => {
      console.warn('榜单查询失败，使用本地记录', err)
      return mergeRankingList([], localRecords, {})
    })
}

function invalidateRankingCache() {
  rankingCache = { date: '', items: null, updatedAt: 0 }
}

function getUserProfile(userId) {
  return coze.queryUser(userId)
    .then((data) => {
      const items = (data && data.items) || []
      if (!items.length) return null
      const u = items[0]
      let badges = []
      try { badges = JSON.parse(u.badges || '[]') } catch (e) { badges = [] }
      return {
        totalDraws: Number(u.total_draws || 0),
        officialDraws: Number(u.official_draws || 0),
        maxScore: Number(u.max_score || 0),
        avgScore: Number(u.avg_score || 0),
        ssrCount: Number(u.ssr_count || 0),
        checkInStreak: Number(u.check_in_streak || 0),
        totalCheckIn: Number(u.total_check_in || 0),
        points: Number(u.points || 0),
        badges,
      }
    })
    .catch(() => null)
}

function createDefaultUser(userId, userInfo) {
  const now = nowTimestamp()
  return {
    openid: userId,
    nickname: (userInfo && userInfo.nickname) || '赛博旅人',
    avatar_url: (userInfo && userInfo.avatarUrl) || '',
    total_draws: 0,
    official_draws: 0,
    max_score: 0,
    avg_score: 0,
    ssr_count: 0,
    check_in_streak: 0,
    max_check_in_streak: 0,
    total_check_in: 0,
    last_check_in_date: '',
    points: 0,
    badges: [],
    created_at: now,
    updated_at: now,
  }
}

function doCheckIn(userId) {
  const date = today()
  const app = getApp()
  const userInfo = app.globalData.userInfo || storage.getUserInfo()

  return coze.queryUser(userId).then((data) => {
    const items = (data && data.items) || []
    const u = items.length ? items[0] : null

    if (u && u.last_check_in_date === date) {
      return { success: false, msg: '今日已签到' }
    }

    let streak = u ? Number(u.check_in_streak || 0) : 0
    const yesterday = require('../utils/date.js').daysAgo(1)
    const lastDate = u ? u.last_check_in_date : ''
    streak = lastDate === yesterday ? streak + 1 : 1
    const total = (u ? Number(u.total_check_in || 0) : 0) + 1
    const maxStreak = Math.max(u ? Number(u.max_check_in_streak || 0) : 0, streak)
    let points = (u ? Number(u.points || 0) : 0) + 10
    let badges = []
    if (u) {
      try { badges = JSON.parse(u.badges || '[]') } catch (e) { badges = [] }
    }

    const milestones = [
      { day: 7, bonus: 50, badge: '7日签到' },
      { day: 30, bonus: 200, badge: '30日签到' },
      { day: 365, bonus: 1000, badge: '365日签到' },
    ]
    milestones.forEach((m) => {
      if (streak >= m.day && badges.indexOf(m.badge) < 0) {
        points += m.bonus
        badges.push(m.badge)
      }
    })

    const payload = u ? {
      openid: userId,
      nickname: u.nickname || userInfo.nickname,
      avatar_url: u.avatar_url || userInfo.avatarUrl || '',
      total_draws: u.total_draws || 0,
      official_draws: u.official_draws || 0,
      max_score: u.max_score || 0,
      avg_score: u.avg_score || 0,
      ssr_count: u.ssr_count || 0,
      check_in_streak: streak,
      max_check_in_streak: maxStreak,
      total_check_in: total,
      last_check_in_date: date,
      points,
      badges,
      created_at: u.created_at,
      updated_at: nowTimestamp(),
    } : Object.assign(createDefaultUser(userId, userInfo), {
      check_in_streak: streak,
      max_check_in_streak: maxStreak,
      total_check_in: total,
      last_check_in_date: date,
      points,
      badges,
      updated_at: nowTimestamp(),
    })

    const action = u ? coze.updateUser(payload) : coze.insertUser(payload)
    return action.then(() => ({ success: true, streak, points }))
  }).catch((err) => {
    console.error('[checkIn]', err)
    return { success: false, msg: err.message || '签到失败，请检查网络与域名配置' }
  })
}

module.exports = {
  checkTodayOfficial,
  generateAndSave,
  getHistory,
  getRanking,
  invalidateRankingCache,
  getUserProfile,
  doCheckIn,
  parseRecord,
}