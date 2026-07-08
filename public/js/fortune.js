import * as minimax from './minimax.js'
import * as coze from './coze.js'
import * as storage from './storage.js'
import { today, nowTimestamp, daysAgo } from './date.js'
import { apiRequest } from './api.js'
import * as state from './state.js'

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

export function parseRecord(item) {
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

export async function checkTodayOfficial(userId) {
  const cached = storage.getCachedTodayFortune(today())
  if (cached && cached.is_official) {
    storage.appendFortuneHistory(cached)
    return cached
  }

  try {
    const data = await coze.queryFortuneByUserAndDate(userId, today())
    const items = (data && data.items) || []
    if (items.length) {
      const record = parseRecord(items[0])
      storage.cacheTodayFortune(record)
      storage.appendFortuneHistory(record)
      return record
    }
    return null
  } catch (e) {
    return null
  }
}

async function updateUserStats(userId, userInfo, fortune, isOfficial) {
  try {
    const data = await coze.queryUser(userId)
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
        badges,
        created_at: u.created_at || now,
        updated_at: now,
      }
      await coze.updateUser(user)
      return
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
    await coze.insertUser(user)
  } catch (err) {
    console.warn('更新用户统计失败', err)
  }
}

export async function generateAndSave(isEntertainment) {
  const userId = state.getUserId()
  const userInfo = state.getUserInfo()
  const isOfficial = !isEntertainment

  const existing = await checkTodayOfficial(userId)
  if (isOfficial && existing) return existing

  const fortune = await minimax.generateFortune(false)
  const record = buildRecord(fortune, userId, userInfo, isOfficial)
  const parsed = parseRecord(record)

  try {
    await coze.insertFortuneRecord(record)
    await updateUserStats(userId, userInfo, fortune, isOfficial)
  } catch (err) {
    console.warn('Coze 保存失败，使用本地缓存', err)
  }

  if (isOfficial) {
    storage.cacheTodayFortune(parsed)
    storage.appendFortuneHistory(parsed)
    invalidateRankingCache()
  }
  state.setCurrentFortune(parsed)
  return parsed
}

export async function getHistory(userId) {
  const cachedToday = storage.getCachedTodayFortune(today())
  if (cachedToday && cachedToday.is_official) {
    storage.appendFortuneHistory(cachedToday)
  }

  try {
    const data = await coze.queryFortuneHistory(userId, 30)
    const cloudList = ((data && data.items) || []).map(parseRecord)
    return storage.mergeHistoryRecords(cloudList, storage.getLocalHistory())
  } catch (err) {
    console.warn('历史查询失败，使用本地记录', err)
    return storage.getLocalHistory()
  }
}

function getTodayLocalRankingRecords() {
  const date = today()
  const userId = state.getUserId()
  const userInfo = state.getUserInfo()
  const cached = storage.getCachedTodayFortune(date)
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

async function getUsersSsrMapForOpenids(openids) {
  const ids = (openids || []).filter(Boolean)
  if (!ids.length) return {}
  try {
    const data = await coze.queryUsersByOpenids(ids)
    const map = {}
    ;((data && data.items) || []).forEach((u) => {
      map[u.openid] = Number(u.ssr_count || 0)
    })
    return map
  } catch (e) {
    return {}
  }
}

async function fetchCloudRanking() {
  const date = today()
  try {
    const data = await apiRequest('/ranking?date=' + date, 'GET')
    return (data && data.items) || []
  } catch (e) {
    const rankData = await coze.queryTodayRanking(100)
    const cloudList = ((rankData && rankData.items) || []).map(parseRecord)
    const openids = cloudList.map((item) => item.openid).filter(Boolean)
    const ssrMap = await getUsersSsrMapForOpenids(openids)
    return mergeRankingList(cloudList, [], ssrMap)
  }
}

export async function getRanking(options = {}) {
  const force = options.force
  const date = today()
  const localToday = getTodayLocalRankingRecords()
  const now = Date.now()

  if (
    !force
    && rankingCache.date === date
    && rankingCache.items
    && now - rankingCache.updatedAt < RANKING_CACHE_TTL
  ) {
    return mergeRankingList(rankingCache.items, localToday, {})
  }

  try {
    const cloudItems = await fetchCloudRanking()
    rankingCache = { date, items: cloudItems, updatedAt: Date.now() }
    return mergeRankingList(cloudItems, localToday, {})
  } catch (err) {
    console.warn('榜单查询失败，使用本地今日记录', err)
    return mergeRankingList([], localToday, {})
  }
}

export function invalidateRankingCache() {
  rankingCache = { date: '', items: null, updatedAt: 0 }
}

export async function getUserProfile(userId) {
  try {
    const data = await coze.queryUser(userId)
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
  } catch (e) {
    return null
  }
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

export async function doCheckIn(userId) {
  const date = today()
  const userInfo = state.getUserInfo()

  try {
    const data = await coze.queryUser(userId)
    const items = (data && data.items) || []
    const u = items.length ? items[0] : null

    if (u && u.last_check_in_date === date) {
      return { success: false, msg: '今日已签到' }
    }

    let streak = u ? Number(u.check_in_streak || 0) : 0
    const yesterday = daysAgo(1)
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

    if (u) await coze.updateUser(payload)
    else await coze.insertUser(payload)
    return { success: true, streak, points }
  } catch (err) {
    return { success: false, msg: err.message || '签到失败，请稍后重试' }
  }
}