const CONNECTOR_ID = '1024'

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

function checkAuth(event) {
  const secret = process.env.API_SECRET
  if (!secret) return true
  const key = event.headers['x-api-key'] || event.headers['X-API-Key']
  return key === secret
}

function getCozeConfig() {
  const token = process.env.COZE_TOKEN
  const fortuneRecords = process.env.COZE_FORTUNE_DB
  const users = process.env.COZE_USERS_DB
  if (!token || !fortuneRecords || !users) {
    throw new Error('Coze 环境变量未配置：COZE_TOKEN / COZE_FORTUNE_DB / COZE_USERS_DB')
  }
  return {
    token,
    baseUrl: process.env.COZE_BASE_URL || 'https://api.coze.cn/v1',
    collections: { fortuneRecords, users },
  }
}

function getMinimaxConfig() {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY 未配置')
  return {
    apiKey,
    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/v1',
    model: process.env.MINIMAX_MODEL || 'Minimax-M3',
  }
}

function stringifyRow(row) {
  const result = {}
  Object.keys(row).forEach((key) => {
    const val = row[key]
    if (val === null || val === undefined) result[key] = ''
    else if (typeof val === 'object') result[key] = JSON.stringify(val)
    else result[key] = String(val)
  })
  return result
}

async function cozeRequest(path, method, data) {
  const cfg = getCozeConfig()
  const res = await fetch(cfg.baseUrl + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  })
  const json = await res.json()
  if (res.ok && json.code === 0) return json.data
  throw new Error((json && json.msg) || 'Coze 请求失败')
}

function equalFilter(conditions) {
  return {
    logic: 'and',
    conditions: conditions.map((c) => ({
      left: c.field,
      operation: 'equal',
      right: String(c.value),
    })),
  }
}

function orFilter(conditions) {
  return {
    logic: 'or',
    conditions: conditions.map((c) => ({
      left: c.field,
      operation: 'equal',
      right: String(c.value),
    })),
  }
}

async function queryRecords(dbKey, options) {
  const cfg = getCozeConfig()
  const databaseId = cfg.collections[dbKey]
  if (!databaseId) throw new Error('未知数据库: ' + dbKey)

  const payload = {
    connector_id: CONNECTOR_ID,
    page_num: options.pageNum || 1,
    page_size: options.pageSize || 20,
    is_async: false,
  }
  if (options.filter) payload.filter = options.filter
  if (options.orderBy) payload.order_by = options.orderBy

  return cozeRequest('/databases/' + databaseId + '/records/query', 'POST', payload)
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

function dedupeRanking(records) {
  const map = {}
  records.forEach((item) => {
    if (!item) return
    const key = item.openid || item.nickname
    const prev = map[key]
    if (!prev || Number(item.score) > Number(prev.score)) map[key] = item
  })
  return Object.values(map)
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 100)
}

async function fetchSsrMap(openids) {
  const map = {}
  if (!openids.length) return map

  const chunkSize = 20
  for (let i = 0; i < openids.length; i += chunkSize) {
    const chunk = openids.slice(i, i + chunkSize)
    const data = await queryRecords('users', {
      filter: orFilter(chunk.map((id) => ({ field: 'openid', value: id }))),
      pageSize: chunk.length,
    })
    ;((data && data.items) || []).forEach((u) => {
      map[u.openid] = Number(u.ssr_count || 0)
    })
  }
  return map
}

function handleOptions(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {})
  return null
}

module.exports = {
  CONNECTOR_ID,
  jsonResponse,
  checkAuth,
  getCozeConfig,
  getMinimaxConfig,
  stringifyRow,
  cozeRequest,
  equalFilter,
  orFilter,
  queryRecords,
  parseRecord,
  dedupeRanking,
  fetchSsrMap,
  handleOptions,
}