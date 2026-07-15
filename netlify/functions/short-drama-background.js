const { jsonResponse, checkAuth, handleOptions } = require('./_shared')
const { processTask } = require('./short-drama-core')

exports.handler = async (event) => {
  const options = handleOptions(event)
  if (options) return options

  if (!checkAuth(event)) return jsonResponse(401, { code: 1, msg: 'Unauthorized' })

  try {
    const body = JSON.parse(event.body || '{}')
    if (!body.task_id) return jsonResponse(400, { code: 1, msg: '缺少 task_id' })
    await processTask(body.task_id)
    return jsonResponse(200, { code: 0, data: { task_id: body.task_id } })
  } catch (err) {
    return jsonResponse(500, { code: 1, msg: err.message || '后台短剧生成失败' })
  }
}
