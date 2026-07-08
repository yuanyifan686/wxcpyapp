const {
  jsonResponse,
  checkAuth,
  getCozeConfig,
  stringifyRow,
  cozeRequest,
  handleOptions,
  CONNECTOR_ID,
} = require('./_shared')

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

exports.handler = async (event) => {
  const options = handleOptions(event)
  if (options) return options

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { code: 1, msg: 'Method Not Allowed' })
  }
  if (!checkAuth(event)) {
    return jsonResponse(401, { code: 1, msg: 'Unauthorized' })
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { action, dbKey, payload, row, filter } = body
    const cfg = getCozeConfig()
    const databaseId = cfg.collections[dbKey]
    if (!databaseId) {
      return jsonResponse(400, { code: 1, msg: '未知数据库: ' + dbKey })
    }

    let data
    if (action === 'insert') {
      const rows = Array.isArray(payload) ? payload : [payload]
      data = await cozeRequest('/databases/' + databaseId + '/records', 'POST', {
        connector_id: CONNECTOR_ID,
        insert_rows: rows.map(stringifyRow),
        is_async: false,
      })
    } else if (action === 'query') {
      data = await cozeRequest('/databases/' + databaseId + '/records/query', 'POST', {
        connector_id: CONNECTOR_ID,
        page_num: payload.pageNum || 1,
        page_size: payload.pageSize || 20,
        is_async: false,
        ...(payload.filter ? { filter: payload.filter } : {}),
        ...(payload.orderBy ? { order_by: payload.orderBy } : {}),
      })
    } else if (action === 'update') {
      data = await cozeRequest('/databases/' + databaseId + '/records', 'PUT', {
        connector_id: CONNECTOR_ID,
        update_fields: rowToUpdateFields(row),
        filter: filter || {
          logic: 'and',
          conditions: [{ left: 'openid', operation: 'equal', right: String(row.openid) }],
        },
        is_async: false,
      })
    } else {
      return jsonResponse(400, { code: 1, msg: '未知 action: ' + action })
    }

    return jsonResponse(200, { code: 0, data })
  } catch (err) {
    return jsonResponse(500, { code: 1, msg: err.message || 'Coze 代理失败' })
  }
}