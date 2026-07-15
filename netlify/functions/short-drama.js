const { jsonResponse, checkAuth, handleOptions } = require('./_shared')
const {
  getTask,
  saveTask,
  normalizeDuration,
  publicTask,
} = require('./short-drama-core')

async function invokeBackground(event, taskId) {
  const host = event.headers.host || event.headers.Host
  if (!host) return
  const proto = event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'] || 'https'
  const headers = { 'Content-Type': 'application/json' }
  if (process.env.API_SECRET) headers['X-API-Key'] = process.env.API_SECRET

  const res = await fetch(proto + '://' + host + '/.netlify/functions/short-drama-background', {
    method: 'POST',
    headers,
    body: JSON.stringify({ task_id: taskId }),
  })
  if (!res.ok && res.status !== 202) {
    throw new Error('后台生成任务启动失败')
  }
}

async function handleCreate(event, body) {
  const duration = normalizeDuration(body.duration)
  if (!body.product_desc || String(body.product_desc).trim().length < 10) {
    return jsonResponse(400, { code: 1, msg: '商品描述不少于 10 个字' })
  }
  const images = Array.isArray(body.images) ? body.images.slice(0, 3) : []
  if (!images.length) return jsonResponse(400, { code: 1, msg: '请至少上传 1 张商品图片' })

  const now = new Date().toISOString()
  const task = {
    id: 'sd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    status: 'queued',
    progress: 8,
    message: '任务已创建，正在启动后台生成',
    product_name: body.product_name || '',
    product_desc: body.product_desc,
    duration,
    images,
    prompt: '',
    video_url: '',
    provider_task_id: '',
    error_message: '',
    created_at: now,
    updated_at: now,
  }

  await saveTask(task)
  task.status = 'uploading'
  task.progress = 12
  task.message = '后台任务已启动，正在上传图片'
  await saveTask(task)

  try {
    await invokeBackground(event, task.id)
  } catch (err) {
    task.status = 'failed'
    task.progress = 100
    task.message = '生成失败'
    task.error_message = err.message || '后台生成任务启动失败'
    await saveTask(task)
  }

  return jsonResponse(200, { code: 0, data: publicTask(task) })
}

async function handleStatus(taskId) {
  const task = await getTask(taskId)
  if (!task) return jsonResponse(404, { code: 1, msg: '任务不存在或已过期' })
  return jsonResponse(200, { code: 0, data: publicTask(task) })
}

exports.handler = async (event) => {
  const options = handleOptions(event)
  if (options) return options

  if (!checkAuth(event)) return jsonResponse(401, { code: 1, msg: 'Unauthorized' })

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      return handleCreate(event, body)
    }
    if (event.httpMethod === 'GET') {
      const taskId = event.queryStringParameters && event.queryStringParameters.task_id
      if (!taskId) return jsonResponse(400, { code: 1, msg: '缺少 task_id' })
      return handleStatus(taskId)
    }
    return jsonResponse(405, { code: 1, msg: 'Method Not Allowed' })
  } catch (err) {
    return jsonResponse(500, { code: 1, msg: err.message || '短剧生成服务异常' })
  }
}
