const { getStore } = require('@netlify/blobs')

const COZE_FILE_UPLOAD_URL = 'https://api.coze.cn/v1/files/upload'
const COZE_WORKFLOW_RUN_URL = 'https://api.coze.cn/v1/workflow/run'
const ARK_TASKS_PATH = '/contents/generations/tasks'
const TASK_STORE_NAME = 'short-drama-tasks'

const memoryTasks = new Map()

function getTaskStore() {
  try {
    return getStore(TASK_STORE_NAME)
  } catch (err) {
    return null
  }
}

async function getTask(taskId) {
  const store = getTaskStore()
  if (store) {
    try {
      return await store.get(taskId, { type: 'json' })
    } catch (err) {
      return memoryTasks.get(taskId) || null
    }
  }
  return memoryTasks.get(taskId) || null
}

async function saveTask(task) {
  task.updated_at = new Date().toISOString()
  memoryTasks.set(task.id, task)
  const store = getTaskStore()
  if (store) {
    await store.setJSON(task.id, task)
  }
  return task
}

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

function normalizeDuration(value) {
  const duration = Number(value) || 10
  if (duration < 5) return 5
  if (duration > 10) return 10
  return duration
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
  const json = await res.json().catch(() => ({}))
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
  const json = await res.json().catch(() => ({}))
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
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.id) {
    throw new Error((json.error && json.error.message) || json.message || 'Seedance 创建任务失败')
  }
  return String(json.id)
}

async function querySeedanceTask(cfg, providerTaskId) {
  const res = await fetch(cfg.arkBaseUrl.replace(/\/$/, '') + ARK_TASKS_PATH + '/' + providerTaskId, {
    headers: { Authorization: 'Bearer ' + cfg.arkApiKey },
  })
  const json = await res.json().catch(() => ({}))
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function processTask(taskId) {
  const cfg = getShortDramaConfig()
  const task = await getTask(taskId)
  if (!task) throw new Error('任务不存在或已过期')

  try {
    task.status = 'uploading'
    task.progress = 18
    task.message = '正在上传图片到 Coze'
    await saveTask(task)

    const images = (task.images || []).map(decodeImage)
    const fileIds = []
    for (const image of images) {
      fileIds.push(await uploadToCoze(cfg, image))
    }

    task.status = 'prompting'
    task.progress = 42
    task.message = '正在生成视频提示词'
    await saveTask(task)

    const cozePrompt = await runCozePromptWorkflow(cfg, task, fileIds)
    const finalPrompt = cleanPrompt(cozePrompt, task.duration)
    task.prompt = finalPrompt
    task.status = 'running'
    task.progress = 68
    task.message = '正在生成视频'
    await saveTask(task)

    task.provider_task_id = await createSeedanceTask(cfg, finalPrompt, images)
    await saveTask(task)

    for (let i = 0; i < 120; i += 1) {
      await sleep(5000)
      const result = await querySeedanceTask(cfg, task.provider_task_id)
      const status = String(result.status || '').toLowerCase()
      if (status === 'succeeded') {
        task.status = 'success'
        task.progress = 100
        task.message = '生成完成'
        task.video_url = extractVideoUrl(result)
        await saveTask(task)
        return
      }
      if (status === 'failed' || status === 'cancelled') {
        throw new Error((result.error && result.error.message) || result.message || 'Seedance 生成失败')
      }
      task.progress = Math.min(96, 68 + Math.floor((i + 1) * 0.4))
      task.message = '正在生成视频'
      await saveTask(task)
    }
    throw new Error('Seedance 生成超时，请稍后重试')
  } catch (err) {
    task.status = 'failed'
    task.progress = 100
    task.message = '生成失败'
    task.error_message = err.message || '生成失败'
    await saveTask(task)
  }
}

module.exports = {
  getTask,
  saveTask,
  normalizeDuration,
  publicTask,
  processTask,
}
