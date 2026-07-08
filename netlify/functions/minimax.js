const { jsonResponse, checkAuth, getMinimaxConfig, handleOptions } = require('./_shared')

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
    const cfg = getMinimaxConfig()
    const res = await fetch(cfg.baseUrl + '/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model || cfg.model,
        messages: body.messages || [],
        temperature: body.temperature ?? 0.95,
        max_tokens: body.max_tokens || 1024,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return jsonResponse(res.status, { code: 1, msg: 'Minimax HTTP ' + res.status, data })
    }
    return jsonResponse(200, { code: 0, data })
  } catch (err) {
    return jsonResponse(500, { code: 1, msg: err.message || 'Minimax 代理失败' })
  }
}