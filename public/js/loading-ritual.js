const STAGES = [
  { threshold: 0, title: '接入宇宙 WiFi', msg: '正在握手量子服务器...' },
  { threshold: 15, title: '扫描星轨', msg: '读取今日黄道偏移量...' },
  { threshold: 32, title: 'AI 神谕运算', msg: 'Minimax 模型推演命运矩阵...' },
  { threshold: 52, title: '解析运势', msg: '计算幸运值 · 摸鱼指数 · 老板风险...' },
  { threshold: 72, title: '封装 BUFF', msg: '生成幸运色 / 数字 / 毒鸡汤...' },
  { threshold: 88, title: '欧皇校准', msg: '最终概率加权中，请保持虔诚...' },
]

const FLAVORS = [
  '别急，SSR 正在排队…',
  '宇宙信号 ████████░░ 80%',
  '偷偷说：等待越久，期待越高',
  '建议同时泡一杯咖啡 ☕',
  '今日宜：耐心等待，忌反复刷新',
  '神谕模型深思考中，请勿断开',
  '已有上千位赛博旅人今日抽签',
  '运气正在下载中… 请勿关闭',
  '卦象显示：好事多磨，再等一下',
  '老板风险指数同步计算中…',
  '摸鱼指数校准：接近最优值',
  '今日星座：摩羯座（加班座）',
]

const MIN_RITUAL_MS = 2600
const COMPLETE_HOLD_MS = 700

function easeProgress(elapsedMs) {
  const t = elapsedMs / 1000
  if (t < 2) return t * 18
  if (t < 5) return 36 + (t - 2) * 10
  if (t < 12) return 66 + (t - 5) * 2.5
  if (t < 25) return 83.5 + (t - 12) * 0.5
  return Math.min(94, 90 + (t - 25) * 0.15)
}

function stageForProgress(pct) {
  let current = STAGES[0]
  for (const s of STAGES) {
    if (pct >= s.threshold) current = s
  }
  return current
}

export class FortuneLoadingRitual {
  constructor() {
    this.el = null
    this.startedAt = 0
    this.progress = 0
    this.flavorIdx = 0
    this.tickTimer = null
    this.flavorTimer = null
    this.completed = false
    this._resolveComplete = null
  }

  mount(parent) {
    const host = parent || document.body
    const existing = host.querySelector('#fortune-ritual')
    if (existing) existing.remove()

    const wrap = document.createElement('div')
    wrap.id = 'fortune-ritual'
    wrap.className = 'ritual-overlay'
    wrap.innerHTML = `
      <div class="ritual-panel glass-card">
        <div class="ritual-visual">
          <div class="ritual-orbit o1"></div>
          <div class="ritual-orbit o2"></div>
          <div class="ritual-core">🔮</div>
          <div class="ritual-sparks"></div>
        </div>
        <div class="ritual-stage-line">
          <span class="ritual-stage-badge" id="ritual-stage">STEP 1</span>
          <span class="ritual-elapsed" id="ritual-elapsed">0s</span>
        </div>
        <h3 class="ritual-title" id="ritual-title">${STAGES[0].title}</h3>
        <p class="ritual-msg" id="ritual-msg">${STAGES[0].msg}</p>
        <div class="ritual-progress-wrap">
          <div class="ritual-progress-track">
            <div class="ritual-progress-fill" id="ritual-progress"></div>
            <div class="ritual-progress-glow"></div>
          </div>
          <span class="ritual-pct" id="ritual-pct">0%</span>
        </div>
        <p class="ritual-flavor" id="ritual-flavor">💬 ${FLAVORS[0]}</p>
        <div class="ritual-steps">
          ${STAGES.map((s, i) => `<span class="ritual-step" data-step="${i}"></span>`).join('')}
        </div>
      </div>
    `
    host.appendChild(wrap)
    this.el = wrap
    this._spawnSparks()
    return this
  }

  _spawnSparks() {
    const box = this.el?.querySelector('.ritual-sparks')
    if (!box) return
    box.innerHTML = Array.from({ length: 10 }, (_, i) => {
      const x = 10 + Math.random() * 80
      const y = 10 + Math.random() * 80
      const d = Math.random() * 2
      return `<span class="ritual-spark" style="left:${x}%;top:${y}%;animation-delay:${d}s"></span>`
    }).join('')
  }

  start() {
    this.startedAt = Date.now()
    this.completed = false
    this._tick()
    this.tickTimer = setInterval(() => this._tick(), 120)
    this.flavorTimer = setInterval(() => this._rotateFlavor(), 2800)
    return this
  }

  _tick() {
    if (!this.el || this.completed) return
    const elapsed = Date.now() - this.startedAt
    this.progress = easeProgress(elapsed)
    this._render(this.progress, elapsed)
  }

  _rotateFlavor() {
    if (!this.el || this.completed) return
    this.flavorIdx = (this.flavorIdx + 1) % FLAVORS.length
    const flavorEl = this.el.querySelector('#ritual-flavor')
    if (flavorEl) {
      flavorEl.classList.remove('flavor-in')
      void flavorEl.offsetWidth
      flavorEl.textContent = '💬 ' + FLAVORS[this.flavorIdx]
      flavorEl.classList.add('flavor-in')
    }
  }

  _render(pct, elapsedMs) {
    const stage = stageForProgress(pct)
    const stageIdx = STAGES.indexOf(stage)

    const titleEl = this.el.querySelector('#ritual-title')
    const msgEl = this.el.querySelector('#ritual-msg')
    const progressEl = this.el.querySelector('#ritual-progress')
    const pctEl = this.el.querySelector('#ritual-pct')
    const stageEl = this.el.querySelector('#ritual-stage')
    const elapsedEl = this.el.querySelector('#ritual-elapsed')

    if (titleEl && titleEl.textContent !== stage.title) {
      titleEl.classList.remove('title-in')
      void titleEl.offsetWidth
      titleEl.textContent = stage.title
      titleEl.classList.add('title-in')
    }
    if (msgEl) msgEl.textContent = stage.msg
    if (progressEl) progressEl.style.width = pct.toFixed(1) + '%'
    if (pctEl) pctEl.textContent = Math.floor(pct) + '%'
    if (stageEl) stageEl.textContent = 'STEP ' + (stageIdx + 1) + '/' + STAGES.length
    if (elapsedEl) elapsedEl.textContent = Math.floor(elapsedMs / 1000) + 's'

    this.el.querySelectorAll('.ritual-step').forEach((dot, i) => {
      dot.classList.toggle('done', i < stageIdx)
      dot.classList.toggle('active', i === stageIdx)
    })
  }

  async complete() {
    const elapsed = Date.now() - this.startedAt
    if (elapsed < MIN_RITUAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_RITUAL_MS - elapsed))
    }

    this.completed = true
    clearInterval(this.tickTimer)
    clearInterval(this.flavorTimer)

    return new Promise((resolve) => {
      const titleEl = this.el?.querySelector('#ritual-title')
      const msgEl = this.el?.querySelector('#ritual-msg')
      const flavorEl = this.el?.querySelector('#ritual-flavor')
      const progressEl = this.el?.querySelector('#ritual-progress')
      const pctEl = this.el?.querySelector('#ritual-pct')
      const panel = this.el?.querySelector('.ritual-panel')

      if (panel) panel.classList.add('ritual-success')
      if (titleEl) titleEl.textContent = '✨ 运势降临'
      if (msgEl) msgEl.textContent = '今日赛博签文已生成，欧皇请查收'
      if (flavorEl) flavorEl.textContent = '🎉 即将为你揭晓…'

      const startPct = this.progress
      const start = performance.now()
      const animate = (now) => {
        const t = Math.min(1, (now - start) / 500)
        const pct = startPct + (100 - startPct) * t
        if (progressEl) progressEl.style.width = pct + '%'
        if (pctEl) pctEl.textContent = Math.floor(pct) + '%'
        if (t < 1) requestAnimationFrame(animate)
        else setTimeout(() => { this.destroy(); resolve() }, COMPLETE_HOLD_MS)
      }
      requestAnimationFrame(animate)
    })
  }

  destroy() {
    clearInterval(this.tickTimer)
    clearInterval(this.flavorTimer)
    this.el?.remove()
    this.el = null
  }
}

export async function runFortuneRitual(parent, generateFn) {
  const ritual = new FortuneLoadingRitual().mount(parent).start()
  try {
    await Promise.all([generateFn(), new Promise((r) => setTimeout(r, MIN_RITUAL_MS))])
    await ritual.complete()
  } catch (err) {
    ritual.destroy()
    throw err
  }
}