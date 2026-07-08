const KEYS = {
  USER_ID: 'cyber_user_id',
  USER_INFO: 'cyber_user_info',
  TODAY_FORTUNE: 'cyber_today_fortune',
  TODAY_FORTUNE_DATE: 'cyber_today_fortune_date',
  FORTUNE_HISTORY: 'cyber_fortune_history',
}

const HISTORY_MAX = 30

function get(key, defaultValue = null) {
  try {
    const val = localStorage.getItem(key)
    if (val === null || val === '') return defaultValue
    return JSON.parse(val)
  } catch (e) {
    return defaultValue
  }
}

function set(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getUserId() {
  let id = get(KEYS.USER_ID)
  if (!id) {
    id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    set(KEYS.USER_ID, id)
  }
  return id
}

export function getUserInfo() {
  return get(KEYS.USER_INFO, { nickname: '赛博旅人', avatarUrl: '' })
}

export function setUserInfo(info) {
  set(KEYS.USER_INFO, info)
}

export function cacheTodayFortune(fortune) {
  set(KEYS.TODAY_FORTUNE, fortune)
  set(KEYS.TODAY_FORTUNE_DATE, fortune.fortune_date)
}

export function getCachedTodayFortune(todayStr) {
  const cachedDate = get(KEYS.TODAY_FORTUNE_DATE)
  if (cachedDate === todayStr) return get(KEYS.TODAY_FORTUNE, null)
  return null
}

export function getLocalHistory() {
  const list = get(KEYS.FORTUNE_HISTORY, [])
  return Array.isArray(list) ? list : []
}

export function appendFortuneHistory(record) {
  if (!record || !record.is_official) return
  const list = getLocalHistory()
  const filtered = list.filter((item) => item.fortune_date !== record.fortune_date)
  filtered.unshift(record)
  set(KEYS.FORTUNE_HISTORY, filtered.slice(0, HISTORY_MAX))
}

export function mergeHistoryRecords(cloudList, localList) {
  const map = {}
  localList.forEach((item) => {
    if (item && item.fortune_date) map[item.fortune_date] = item
  })
  cloudList.forEach((item) => {
    if (item && item.fortune_date) map[item.fortune_date] = item
  })
  return Object.keys(map)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((k) => map[k])
    .slice(0, HISTORY_MAX)
}