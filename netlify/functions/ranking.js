const {
  jsonResponse,
  checkAuth,
  equalFilter,
  queryRecords,
  parseRecord,
  dedupeRanking,
  fetchSsrMap,
  handleOptions,
} = require('./_shared')

exports.handler = async (event) => {
  const options = handleOptions(event)
  if (options) return options

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonResponse(405, { code: 1, msg: 'Method Not Allowed' })
  }
  if (!checkAuth(event)) {
    return jsonResponse(401, { code: 1, msg: 'Unauthorized' })
  }

  try {
    let date = ''
    if (event.httpMethod === 'GET') {
      date = (event.queryStringParameters && event.queryStringParameters.date) || ''
    } else {
      const body = JSON.parse(event.body || '{}')
      date = body.date || ''
    }
    if (!date) {
      date = new Date().toISOString().slice(0, 10)
    }

    const rankData = await queryRecords('fortuneRecords', {
      filter: equalFilter([
        { field: 'fortune_date', value: date },
        { field: 'is_official', value: '1' },
      ]),
      orderBy: [{ field_name: 'score', direction: 'desc' }],
      pageSize: 100,
    })

    const cloudList = ((rankData && rankData.items) || []).map(parseRecord)
    const deduped = dedupeRanking(cloudList)
    const openids = deduped.map((item) => item.openid).filter(Boolean)
    const ssrMap = await fetchSsrMap(openids)

    const items = deduped.map((record) => ({
      ...record,
      ssrCount: ssrMap[record.openid] || (record.level === 'SSR' ? 1 : 0),
    }))

    return jsonResponse(200, {
      code: 0,
      data: {
        date,
        items,
        total: items.length,
        updatedAt: Date.now(),
      },
    })
  } catch (err) {
    return jsonResponse(500, { code: 1, msg: err.message || '排行榜查询失败' })
  }
}