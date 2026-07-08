/**
 * Coze 数据库服务封装
 */
const config = require('../config/index.js')

const CONNECTOR_ID = '1024'
const DB_KEY_MAP = {
  fortuneRecords: 'fortuneRecords',
  users: 'users',
  checkIns: 'checkIns',
}

function getToken() {
  return config.coze.token
}

function getDatabaseId(dbKey) {
  const id = config.coze.collections[dbKey]
  if (!id) {
    throw new Error('Coze database_id 未配置: ' + dbKey)
  }
  return id
}

function stringifyRow(row) {
  const result = {}
  Object.keys(row).forEach((key) => {
    const val = row[key]
    if (val === null || val === undefined) {
      result[key] = ''
    } else if (typeof val === 'object') {
      result[key] = JSON.stringify(val)
    } else {
      result[key] = String(val)
    }
  })
  return result
}

function request(path, method, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.coze.baseUrl + path,
      method,
      header: {
        Authorization: 'Bearer ' + getToken(),
        'Content-Type': 'application/json',
      },
      data,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          const msg = (res.data && res.data.msg) || 'Coze 请求失败'
          reject(new Error(msg))
        }
      },
      fail(err) {
        reject(err)
      },
    })
  })
}

function insertRecords(dbKey, rows) {
  const databaseId = getDatabaseId(dbKey)
  return request('/databases/' + databaseId + '/records', 'POST', {
    connector_id: CONNECTOR_ID,
    insert_rows: rows.map(stringifyRow),
    is_async: false,
  })
}

function queryRecords(dbKey, options) {
  const databaseId = getDatabaseId(dbKey)
  const payload = {
    connector_id: CONNECTOR_ID,
    page_num: options.pageNum || 1,
    page_size: options.pageSize || 20,
    is_async: false,
  }
  if (options.filter) payload.filter = options.filter
  if (options.orderBy) payload.order_by = options.orderBy
  return request('/databases/' + databaseId + '/records/query', 'POST', payload)
}

function rowToUpdateFields(row) {
  return Object.keys(row)
    .filter((key) => key !== 'id' && key !== 'openid')
    .map((key) => ({
      field_name: key,
      value: row[key] === null || row[key] === undefined
        ? ''
        : typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key]),
    }))
}

function updateRecords(dbKey, row, filter) {
  const databaseId = getDatabaseId(dbKey)
  return request('/databases/' + databaseId + '/records', 'PUT', {
    connector_id: CONNECTOR_ID,
    update_fields: rowToUpdateFields(row),
    filter: filter || equalFilter([{ field: 'openid', value: row.openid }]),
    is_async: false,
  })
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

function insertFortuneRecord(record) {
  return insertRecords(DB_KEY_MAP.fortuneRecords, [record])
}

function queryFortuneByUserAndDate(openid, fortuneDate) {
  return queryRecords(DB_KEY_MAP.fortuneRecords, {
    filter: equalFilter([
      { field: 'openid', value: openid },
      { field: 'fortune_date', value: fortuneDate },
      { field: 'is_official', value: '1' },
    ]),
    pageSize: 1,
  })
}

function queryFortuneHistory(openid, limit) {
  return queryRecords(DB_KEY_MAP.fortuneRecords, {
    filter: equalFilter([
      { field: 'openid', value: openid },
      { field: 'is_official', value: '1' },
    ]),
    orderBy: [{ field_name: 'fortune_date', direction: 'desc' }],
    pageSize: limit || 30,
  })
}

function queryTodayRanking(limit) {
  const { today } = require('../utils/date.js')
  return queryRecords(DB_KEY_MAP.fortuneRecords, {
    filter: equalFilter([
      { field: 'fortune_date', value: today() },
      { field: 'is_official', value: '1' },
    ]),
    orderBy: [{ field_name: 'score', direction: 'desc' }],
    pageSize: limit || 100,
  })
}

function queryUser(openid) {
  return queryRecords(DB_KEY_MAP.users, {
    filter: equalFilter([{ field: 'openid', value: openid }]),
    pageSize: 1,
  })
}

function insertUser(user) {
  return insertRecords(DB_KEY_MAP.users, [user])
}

function updateUser(user) {
  return updateRecords(DB_KEY_MAP.users, user)
}

module.exports = {
  insertRecords,
  queryRecords,
  updateRecords,
  insertFortuneRecord,
  queryFortuneByUserAndDate,
  queryFortuneHistory,
  queryTodayRanking,
  queryUser,
  insertUser,
  updateUser,
}