import { escapeHtml } from './ui.js'

const TAB_ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3L3 10v11h7v-6h4v6h7V10L12 3z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ranking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17h10M8 17l1-5h6l1 5"/><path d="M9 7h6l1 3H8l1-3z"/><path d="M12 3v2"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/></svg>',
}

export function wrapPage(content, pageClass = '') {
  return `
    <div class="page-scene ${pageClass}">
      <div class="scene-ambient">
        <div class="scene-orb scene-orb-a"></div>
        <div class="scene-orb scene-orb-b"></div>
        <div class="scene-grid"></div>
        <div class="scene-scanlines"></div>
      </div>
      <div class="page-content container">${content}</div>
    </div>
  `
}

export function renderPageHeader({ chip = 'CYBER', title, subtitle = '' }) {
  return `
    <header class="page-hero fade-in">
      <div class="hero-chip"><span class="chip-dot"></span>${escapeHtml(chip)}</div>
      <h1 class="page-title gradient-text">${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="page-desc">${escapeHtml(subtitle)}</p>` : ''}
      <div class="hero-line"><span></span><span class="line-glow"></span><span></span></div>
    </header>
  `
}

export function renderCyberLoader(text = '数据同步中') {
  return `
    <div class="cyber-loader glass-card">
      <div class="loader-ring"></div>
      <div class="loader-ring loader-ring-2"></div>
      <span class="loader-text">${escapeHtml(text)}</span>
    </div>
  `
}

export function renderMarquee(items) {
  const row = (items || []).map((t) =>
    `<span class="marquee-item">${escapeHtml(t)}</span>`
  ).join('<span class="marquee-sep">◆</span>')
  return `
    <div class="marquee-wrap glass-card fade-in">
      <span class="marquee-tag">LIVE</span>
      <div class="marquee-track">
        <div class="marquee-inner">${row}${row}</div>
      </div>
    </div>
  `
}

export function renderStatChips(chips) {
  return `
    <div class="stat-chips fade-in">
      ${(chips || []).map((c) => `
        <div class="stat-chip glass-card">
          <span class="chip-icon">${c.icon || '✦'}</span>
          <span class="chip-val">${escapeHtml(String(c.value))}</span>
          <span class="chip-label">${escapeHtml(c.label)}</span>
        </div>
      `).join('')}
    </div>
  `
}

export function renderNeonCard(content, extraClass = '') {
  return `
    <div class="neon-card glass-card ${extraClass}">
      <span class="corner tl"></span>
      <span class="corner tr"></span>
      <span class="corner bl"></span>
      <span class="corner br"></span>
      ${content}
    </div>
  `
}

export function rankMedal(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

export function levelBadgeClass(level) {
  const map = { SSR: 'badge-ssr', SR: 'badge-sr', R: 'badge-r', N: 'badge-n' }
  return map[level] || 'badge-n'
}

export function initTabIcons() {
  document.querySelectorAll('.tab-item').forEach((el) => {
    const tab = el.dataset.tab
    const iconEl = el.querySelector('.tab-icon')
    if (iconEl && TAB_ICONS[tab]) iconEl.innerHTML = TAB_ICONS[tab]
  })
}

export function spawnParticles(container, count = 16) {
  if (!container) return
  container.innerHTML = Array.from({ length: count }, (_, i) => {
    const x = 5 + Math.random() * 90
    const y = 5 + Math.random() * 90
    const delay = Math.random() * 3
    const size = 2 + Math.random() * 3
    return `<span class="float-particle" style="left:${x}%;top:${y}%;animation-delay:${delay}s;width:${size}px;height:${size}px"></span>`
  }).join('')
}