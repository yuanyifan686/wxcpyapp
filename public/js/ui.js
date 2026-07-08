const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=cyber'

export const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber2',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber3',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber5',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber6',
]

export { DEFAULT_AVATAR }

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function showToast(msg, duration = 2500) {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    el.className = 'toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(el._timer)
  el._timer = setTimeout(() => el.classList.remove('show'), duration)
}

export function showConfirm(title, content) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.innerHTML = `
      <div class="modal-card glass-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(content)}</p>
        <div class="modal-actions">
          <button class="glass-btn ghost" data-action="cancel">取消</button>
          <button class="glass-btn" data-action="ok">确定</button>
        </div>
      </div>
    `
    overlay.addEventListener('click', (e) => {
      const action = e.target.dataset.action
      if (action === 'ok') { resolve(true); overlay.remove() }
      if (action === 'cancel') { resolve(false); overlay.remove() }
    })
    document.body.appendChild(overlay)
  })
}

const BUFF_LABELS = {
  color: { label: '幸运色', emoji: '🎨' },
  number: { label: '幸运数', emoji: '🔢' },
  emoji: { label: '幸运Emoji', emoji: '✨' },
  drink: { label: '幸运饮料', emoji: '🥤' },
  song: { label: '幸运歌曲', emoji: '🎵' },
  direction: { label: '幸运方向', emoji: '🧭' },
  time: { label: '幸运时间', emoji: '⏰' },
  weather: { label: '幸运天气', emoji: '🌤' },
  career: { label: '幸运职业', emoji: '💼' },
  food: { label: '幸运食物', emoji: '🍗' },
  pet: { label: '幸运宠物', emoji: '🐱' },
  city: { label: '幸运城市', emoji: '🏙' },
}

export function renderBuffGrid(buff) {
  const items = Object.keys(BUFF_LABELS).map((key) => ({
    label: BUFF_LABELS[key].label,
    emoji: key === 'emoji' ? (buff.emoji || '✨') : BUFF_LABELS[key].emoji,
    value: String(buff[key] || '-'),
  }))
  return `
    <div class="buff-grid glass-card">
      <div class="grid-title">今日 BUFF</div>
      <div class="grid">
        ${items.map((item, i) => `
          <div class="grid-item fade-in" style="animation-delay:${i * 0.05}s">
            <span class="item-emoji">${item.emoji}</span>
            <span class="item-label">${escapeHtml(item.label)}</span>
            <span class="item-value">${escapeHtml(item.value)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

export function renderTags(tags) {
  return (tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')
}

export function renderStars(count) {
  let html = ''
  for (let i = 0; i < count; i++) {
    html += `<span class="star-icon star-pop" style="animation-delay:${i * 0.08}s">★</span>`
  }
  for (let i = count; i < 5; i++) {
    html += '<span class="star-icon dim">★</span>'
  }
  return html
}