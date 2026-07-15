const { jsonResponse, checkAuth, handleOptions } = require('./_shared')

const tasks = new Map()

const COZE_FILE_UPLOAD_URL = 'https://api.coze.cn/v1/files/upload'
const COZE_WORKFLOW_RUN_URL = 'https://api.coze.cn/v1/workflow/run'
const ARK_TASKS_PATH = '/contents/generations/tasks'

function getShortDramaConfig() {
  const cozeToken = process.env.COZE_TOKEN
  const cozeWorkflowId = process.env.COZE_SHORT_DRAMA_WORKFLOW_ID || process.env.COZE_WORKFLOW_ID
  const arkApiKey = process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY
  if (!cozeToken || !cozeWorkflowId || !arkApiKey) {
    throw new Error('短剧环境变量未配置：COZE_TOKEN / COZE_SHORT_DRAMA_WORKFLOW_ID / ARK_API_KEY')
  }
  return {
    cozeToken,
    cozeWorkflowId,
    cozeBaseUrl: process.env.COZE_BASE_URL || 'https://api.coze.cn/v1',
    arkApiKey,
    arkBaseUrl: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    seedanceModel: process.env.SEEDANCE_MODEL || 'doubao-seedance-1-5-pro-251215',
  }
}

function decodeImage(image) {
  const match = String(image.dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error('图片格式错误，请上传 jpg/png/webp 图片')
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
    name: image.name || 'product.jpg',
    dataUrl: image.dataUrl,
  }
}

async function uploadToCoze(cfg, image) {
  const form = new FormData()
  form.append('purpose', 'workflow_file')
  form.append('file', new Blob([image.buffer], { type: image.mimeType }), image.name)

  const res = await fetch(COZE_FILE_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.cozeToken },
    body: form,
  })
  const json = await res.json()
  if (!res.ok || json.code !== 0) {
    throw new Error((json && json.msg) || 'Coze 图片上传失败')
  }
  const fileId = json.data && json.data.id
  if (!fileId) throw new Error('Coze 图片上传未返回 file_id')
  return String(fileId)
}

async function runCozePromptWorkflow(cfg, body, fileIds) {
  const payload = {
    workflow_id: cfg.cozeWorkflowId,
    parameters: {
      duration: body.duration,
      product_desc: body.product_desc,
      api_key: cfg.arkApiKey,
      product_images: fileIds.map((id) => JSON.stringify({ file_id: id })),
    },
    is_async: false,
  }
  const res = await fetch(COZE_WORKFLOW_RUN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + cfg.cozeToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok || json.code !== 0) {
    throw new Error((json && json.msg) || 'Coze 提示词工作流失败')
  }
  const prompt = parsePrompt(json.data || json.output || json)
  if (!prompt) throw new Error('Coze 未返回视频提示词')
  return prompt
}

function parsePrompt(output) {
  if (!output) return ''
  if (typeof output === 'string') {
    const text = output.trim()
    if (!text) return ''
    try {
      return parsePrompt(JSON.parse(text)) || text
    } catch (err) {
      return text
    }
  }
  if (typeof output === 'object') {
    for (const key of ['video_prompt', 'prompt', 'script', 'output', 'Output']) {
      if (output[key]) return parsePrompt(output[key])
    }
    return JSON.stringify(output)
  }
  return String(output)
}

function cleanPrompt(prompt, duration) {
  const replacements = {
    画面添加同步简体人物对白字幕: '画面保持干净，不添加文字元素',
    画面添加同步简体对话字幕: '画面保持干净，不添加文字元素',
    添加同步简体人物对白字幕: '不添加文字元素',
    添加同步简体对话字幕: '不添加文字元素',
    添加同步台词字幕: '不添加文字元素',
    添加同步字幕: '不添加文字元素',
    同步简体人物对白字幕: '无文字元素',
    同步简体对话字幕: '无文字元素',
    同步台词字幕: '无文字元素',
    简体同步字幕: '无文字元素',
    对白字幕: '文字元素',
    字幕: '文字元素',
  }
  let text = String(prompt || '').trim()
  Object.keys(replacements).forEach((key) => {
    text = text.split(key).join(replacements[key])
  })
  text += '\n\n硬性要求：视频画面保持干净，不出现任何屏幕文字、台词文字、说明文字、标题、角标或文字叠加；人物可以有表情和动作，但不要生成文字元素。'
  if (!text.includes('--duration') && !text.includes('--dur')) text += ' --duration ' + duration
  if (!text.includes('--ratio') && !text.includes('--rt')) text += ' --ratio 9:16'
  if (!text.includes('--camerafixed') && !text.includes('--cf')) text += ' --camerafixed false'
  if (!text.includes('--watermark') && !text.includes('--wm')) text += ' --watermark true'
  return text
}

async function createSeedanceTask(cfg, prompt, images) {
  const content = [{ type: 'text', text: prompt }]
  images.forEach((img) => {
    content.push({
      type: 'image_url',
      image_url: { url: img.dataUrl },
    })
  })

  const res = await fetch(cfg.arkBaseUrl.replace(/\/$/, '') + ARK_TASKS_PATH, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + cfg.arkApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.seedanceModel,
      content,
    }),
  })
  const json = await res.json()
  if (!res.ok || !json.id) {
    throw new Error((json.error && json.error.message) || json.message || 'Seedance 创建任务失败')
  }
  return String(json.id)
}

async function querySeedanceTask(cfg, providerTaskId) {
  const res = await fetch(cfg.arkBaseUrl.replace(/\/$/, '') + ARK_TASKS_PATH + '/' + providerTaskId, {
    headers: { Authorization: 'Bearer ' + cfg.arkApiKey },
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error((json.error && json.error.message) || json.message || 'Seedance 查询任务失败')
  }
  return json
}

function extractVideoUrl(result) {
  if (!result) return ''
  if (result.video_url) return result.video_url
  if (result.url) return result.url
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item && (item.video_url || item.url)) return item.video_url || item.url
    }
  }
  if (result.content && typeof result.content === 'object') {
    return result.content.video_url || result.content.url || ''
  }
  return ''
}

function publicTask(task) {
  return {
    task_id: task.id,
    status: task.status,
    progress: task.progress,
    message: task.message,
    product_name: task.product_name,
    prompt: task.prompt,
    video_url: task.video_url,
    error_message: task.error_message,
    created_at: task.created_at,
    updated_at: task.updated_at,
  }
}

async function handleCreate(body) {
  const cfg = getShortDramaConfig()
  body.duration = normalizeDuration(body.duration)
  if (!body.product_desc || String(body.product_desc).trim().length < 10) {
    return jsonResponse(400, { code: 1, msg: '商品描述不少于 10 个字' })
  }
  const rawImages = Array.isArray(body.images) ? body.images.slice(0, 3) : []
  if (!rawImages.length) return jsonResponse(400, { code: 1, msg: '请至少上传 1 张商品图片' })

  const id = 'sd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
  const now = new Date().toISOString()
  const task = {
    id,
    status: 'queued',
    progress: 8,
    message: '任务已创建',
    product_name: body.product_name || '',
    prompt: '',
    video_url: '',
    provider_task_id: '',
    error_message: '',
    created_at: now,
    updated_at: now,
  }
  tasks.set(id, task)

  Promise.resolve()
    .then(async () => {
      task.status = 'uploading'
      task.progress = 18
      task.message = '正在上传图片到 Coze'
      task.updated_at = new Date().toISOString()

      const images = rawImages.map(decodeImage)
      const fileIds = []
      for (const image of images) {
        fileIds.push(await uploadToCoze(cfg, image))
      }

      task.status = 'prompting'
      task.progress = 38
      task.message = '正在生成视频提示词'
      task.updated_at = new Date().toISOString()

      const cozePrompt = await runCozePromptWorkflow(cfg, body, fileIds)
      const finalPrompt = cleanPrompt(cozePrompt, body.duration)
      task.prompt = finalPrompt

      task.status = 'running'
      task.progress = 68
      task.message = '正在生成视频'
      task.updated_at = new Date().toISOString()
      task.provider_task_id = await createSeedanceTask(cfg, finalPrompt, images)
    })
    .catch((err) => {
      task.status = 'failed'
      task.progress = 100
      task.message = '生成失败'
      task.error_message = err.message || '生成失败'
      task.updated_at = new Date().toISOString()
    })

  return jsonResponse(200, { code: 0, data: publicTask(task) })
}

function normalizeDuration(value) {
  const duration = Number(value) || 10
  if (duration < 5) return 5
  if (duration > 10) return 10
  return duration
}

async function handleStatus(taskId) {
  const cfg = getShortDramaConfig()
  const task = tasks.get(taskId)
  if (!task) return jsonResponse(404, { code: 1, msg: '任务不存在或已过期' })

  if (task.status === 'running' && task.provider_task_id) {
    try {
      const result = await querySeedanceTask(cfg, task.provider_task_id)
      const status = String(result.status || '').toLowerCase()
      if (status === 'succeeded') {
        task.status = 'success'
        task.progress = 100
        task.message = '生成完成'
        task.video_url = extractVideoUrl(result)
      } else if (status === 'failed' || status === 'cancelled') {
        task.status = 'failed'
        task.progress = 100
        task.message = '生成失败'
        task.error_message = (result.error && result.error.message) || result.message || 'Seedance 生成失败'
      } else {
        task.progress = Math.min(92, task.progress + 3)
        task.message = '正在生成视频'
      }
      task.updated_at = new Date().toISOString()
    } catch (err) {
      task.error_message = err.message || '查询失败'
      task.updated_at = new Date().toISOString()
    }
  }

  return jsonResponse(200, { code: 0, data: publicTask(task) })
}

exports.handler = async (event) => {
  const options = handleOptions(event)
  if (options) return options

  if (!checkAuth(event)) return jsonResponse(401, { code: 1, msg: 'Unauthorized' })

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      return handleCreate(body)
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
