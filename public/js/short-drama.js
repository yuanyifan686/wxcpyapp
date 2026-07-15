const state = {
  images: [],
  taskId: '',
  pollTimer: null,
  prompt: '',
}

const $ = (selector) => document.querySelector(selector)

function toast(message, isError = false) {
  const el = $('#toast')
  el.textContent = message
  el.classList.toggle('error', isError)
  el.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600)
}

async function api(path, options = {}) {
  const res = await fetch(path, options)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '请求失败')
  }
  return json.data
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function addFiles(fileList) {
  const files = Array.from(fileList || [])
  const remain = 3 - state.images.length
  if (remain <= 0) {
    toast('最多上传 3 张图片', true)
    return
  }
  for (const file of files.slice(0, remain)) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast('仅支持 jpg / png / webp', true)
      continue
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('单张图片请控制在 8MB 内', true)
      continue
    }
    const dataUrl = await fileToDataUrl(file)
    state.images.push({ name: file.name, type: file.type, dataUrl })
  }
  renderThumbs()
}

function renderThumbs() {
  const grid = $('#thumb-grid')
  grid.innerHTML = state.images.map((image, index) => `
    <div class="thumb">
      <img src="${image.dataUrl}" alt="商品图 ${index + 1}" />
      <button type="button" data-index="${index}" aria-label="移除图片">×</button>
    </div>
  `).join('')
  grid.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      state.images.splice(Number(button.dataset.index), 1)
      renderThumbs()
    })
  })
}

function setProgress(task) {
  const status = task.status || 'ready'
  const progress = Number(task.progress || 0)
  const titles = {
    queued: '排队中',
    uploading: '上传图片',
    prompting: '生成提示词',
    running: '生成视频中',
    success: '生成完成',
    failed: '生成失败',
  }
  $('#status-title').textContent = titles[status] || '等待提交'
  $('#status-badge').textContent = status.toUpperCase()
  $('#status-badge').className = 'badge ' + status
  $('#progress-message').textContent = task.message || '任务处理中'
  $('#progress-percent').textContent = `${Math.round(progress)}%`
  $('#progress-fill').style.width = `${Math.max(0, Math.min(100, progress))}%`

  if (task.prompt) {
    state.prompt = task.prompt
    $('#prompt-output').textContent = task.prompt
    $('#copy-prompt').disabled = false
  }

  if (task.video_url) {
    $('#video-card').innerHTML = `
      <video src="${task.video_url}" controls playsinline></video>
      <div class="result-actions">
        <a class="primary-btn" href="${task.video_url}" target="_blank" rel="noopener">打开视频</a>
      </div>
    `
  }

  if (task.error_message) {
    $('#video-card').innerHTML = `<div class="empty error-text">${escapeHtml(task.error_message)}</div>`
  }
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer)
    state.pollTimer = null
  }
}

async function pollTask() {
  if (!state.taskId) return
  try {
    const task = await api(`/api/short-drama?task_id=${encodeURIComponent(state.taskId)}`)
    setProgress(task)
    if (['success', 'failed', 'timeout', 'cancelled'].includes(task.status)) {
      stopPolling()
    }
  } catch (err) {
    toast(err.message, true)
  }
}

async function submitTask(event) {
  event.preventDefault()
  if (!state.images.length) {
    toast('请先上传商品图片', true)
    return
  }
  const productDesc = $('#product-desc').value.trim()
  if (productDesc.length < 10) {
    toast('商品介绍不少于 10 个字', true)
    return
  }

  const button = $('#submit-btn')
  button.disabled = true
  button.textContent = '提交中...'
  stopPolling()
  setProgress({
    status: 'uploading',
    progress: 12,
    message: '正在提交图片和商品介绍',
  })

  try {
    const task = await api('/api/short-drama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name: $('#product-name').value.trim(),
        product_desc: productDesc,
        duration: Number($('#duration').value),
        images: state.images,
      }),
    })
    state.taskId = task.task_id
    setProgress(task)
    toast('任务已创建，正在生成')
    state.pollTimer = setInterval(pollTask, 4500)
    pollTask()
  } catch (err) {
    setProgress({
      status: 'failed',
      progress: 100,
      message: '提交失败',
      error_message: err.message,
    })
    toast(err.message, true)
  } finally {
    button.disabled = false
    button.textContent = '生成短剧视频'
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function initUpload() {
  const zone = $('#upload-zone')
  const input = $('#image-input')
  zone.addEventListener('click', () => input.click())
  input.addEventListener('change', () => {
    addFiles(input.files)
    input.value = ''
  })
  zone.addEventListener('dragover', (event) => {
    event.preventDefault()
    zone.classList.add('dragover')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'))
  zone.addEventListener('drop', (event) => {
    event.preventDefault()
    zone.classList.remove('dragover')
    addFiles(event.dataTransfer.files)
  })
}

$('#drama-form').addEventListener('submit', submitTask)
$('#copy-prompt').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.prompt)
    toast('提示词已复制')
  } catch (err) {
    toast('复制失败', true)
  }
})
initUpload()
