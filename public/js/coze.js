import { apiRequest } from './api.js'
import { today } from './date.js'

const CONNECTOR_ID = '1024'
const DB_KEY_MAP = {
  fortuneRecords: 'fortuneRecords',
  users: 'users',
}

function proxyAction(action, data) {
  return apiRequest('/coze', 'POST', {
    action,
    dbKey: data._dbKey,
    payload: data._payload,
    row: data._row,
    filter: data._filter,
  })
}

export function equalFilter(conditions) {
  return {
    logic: 'and',
    conditions: conditions.map((c) => ({
      left: c.field,
      operation: 'equal',
      right: String(c.value),
    })),
  }
}

export function orFilter(conditions) {
  return {
    logic: 'or',
    conditions: conditions.map((c) => ({
      left: c.field,
      operation: 'equal',
      right: String(c.value),
    })),
  }
}

function insertRecords(dbKey, rows) {
  return proxyAction('insert', { _dbKey: dbKey, _payload: rows })
}

function queryRecords(dbKey, options) {
  return proxyAction('query', {
    _dbKey: dbKey,
    _payload: {
      pageNum: options.pageNum || 1,
      pageSize: options.pageSize || 20,
      filter: options.filter,
      orderBy: options.orderBy,
    },
  })
}

function updateRecords(dbKey, row, filter) {
  return proxyAction('update', {
    _dbKey: dbKey,
    _row: row,
    _filter: filter || equalFilter([{ field: 'openid', value: row.openid }]),
  })
}

export function insertFortuneRecord(record) {
  return insertRecords(DB_KEY_MAP.fortuneRecords, [record])
}

export function queryFortuneByUserAndDate(openid, fortuneDate) {
  return queryRecords(DB_KEY_MAP.fortuneRecords, {
    filter: equalFilter([
      { field: 'openid', value: openid },
      { field: 'fortune_date', value: fortuneDate },
      { field: 'is_official', value: '1' },
    ]),
    pageSize: 1,
  })
}

export function queryFortuneHistory(openid, limit) {
  return queryRecords(DB_KEY_MAP.fortuneRecords, {
    filter: equalFilter([
      { field: 'openid', value: openid },
      { field: 'is_official', value: '1' },
    ]),
    orderBy: [{ field_name: 'fortune_date', direction: 'desc' }],
    pageSize: limit || 30,
  })
}

export function queryRankingByDate(fortuneDate, limit) {
  return queryRecords(DB_KEY_MAP.fortuneRecords, {
    filter: equalFilter([
      { field: 'fortune_date', value: fortuneDate },
      { field: 'is_official', value: '1' },
    ]),
    orderBy: [{ field_name: 'score', direction: 'desc' }],
    pageSize: limit || 100,
  })
}

export function queryTodayRanking(limit) {
  return queryRankingByDate(today(), limit)
}

export function queryUser(openid) {
  return queryRecords(DB_KEY_MAP.users, {
    filter: equalFilter([{ field: 'openid', value: openid }]),
    pageSize: 1,
  })
}

export function queryUsersByOpenids(openids) {
  if (!openids || !openids.length) return Promise.resolve({ items: [] })
  return queryRecords(DB_KEY_MAP.users, {
    filter: orFilter(openids.map((id) => ({ field: 'openid', value: id }))),
    pageSize: openids.length,
  })
}

export function insertUser(user) {
  return insertRecords(DB_KEY_MAP.users, [user])
}

export function updateUser(user) {
  return updateRecords(DB_KEY_MAP.users, user)
}