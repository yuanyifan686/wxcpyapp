const KEYS = {
  USER_ID: 'cyber_user_id',
  USER_INFO: 'cyber_user_info',
  ONBOARDED: 'cyber_onboarded',
  TODAY_FORTUNE: 'cyber_today_fortune',
  TODAY_FORTUNE_DATE: 'cyber_today_fortune_date',
  FORTUNE_HISTORY: 'cyber_fortune_history',
}

const NICKNAME_MIN = 2
const NICKNAME_MAX = 16

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
  return get(KEYS.USER_INFO, { nickname: '', avatarUrl: '' })
}

export function setUserInfo(info) {
  set(KEYS.USER_INFO, info)
}

export function isOnboarded() {
  if (get(KEYS.ONBOARDED, false) === true) return true
  const info = getUserInfo()
  const legacy = String(info.nickname || '').trim()
  if (legacy.length >= NICKNAME_MIN) {
    set(KEYS.ONBOARDED, true)
    return true
  }
  return false
}

export function validateNickname(name) {
  const trimmed = String(name || '').trim()
  if (trimmed.length < NICKNAME_MIN) {
    return { ok: false, msg: `用户名至少 ${NICKNAME_MIN} 个字符` }
  }
  if (trimmed.length > NICKNAME_MAX) {
    return { ok: false, msg: `用户名最多 ${NICKNAME_MAX} 个字符` }
  }
  return { ok: true, value: trimmed }
}

export function completeOnboarding(nickname, avatarUrl) {
  const check = validateNickname(nickname)
  if (!check.ok) return check
  setUserInfo({ nickname: check.value, avatarUrl: avatarUrl || '' })
  set(KEYS.ONBOARDED, true)
  return { ok: true, nickname: check.value }
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