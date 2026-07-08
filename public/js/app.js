import * as fortune from './fortune.js'
import * as state from './state.js'
import { formatDisplay } from './date.js'
import { animateNumber, scoreToStars, levelColor } from './animation.js'
import {
  escapeHtml, showToast, showConfirm, DEFAULT_AVATAR, AVATAR_PRESETS,
  renderBuffGrid, renderTags, renderStars,
} from './ui.js'

const appEl = document.getElementById('app')
const tabBar = document.getElementById('tab-bar')
const TABS = ['home', 'history', 'ranking', 'profile']

let homeState = { loading: false, animating: false, exploding: false, hasOfficialToday: false }
let rankingRefreshBound = false

function navigate(path) {
  location.hash = '#/' + path
}

function getRoute() {
  const hash = location.hash.replace(/^#\/?/, '') || 'home'
  return hash.split('?')[0]
}

function setTabActive(route) {
  tabBar.querySelectorAll('.tab-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.tab === route)
  })
  const isTab = TABS.includes(route)
  tabBar.style.display = isTab ? 'flex' : 'none'
  appEl.classList.toggle('full-height', !isTab)
}

async function router() {
  const route = getRoute()
  setTabActive(route)

  switch (route) {
    case 'result': await renderResult(); break
    case 'history': await renderHistory(); break
    case 'ranking': await renderRanking(); break
    case 'profile': await renderProfile(); break
    default: await renderHome(); break
  }
}

function bindTabBar() {
  tabBar.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab-item')?.dataset.tab
    if (tab) navigate(tab)
  })
}

/* ── Home ── */
async function renderHome() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100, delay: Math.random() * 3,
  }))

  const record = await fortune.checkTodayOfficial(state.getUserId())
  homeState.hasOfficialToday = !!record
  if (record) state.setCurrentFortune(record)

  appEl.innerHTML = `
    <div class="home-page">
      <div class="bg-gradient"></div>
      <div class="stars">${stars.map((s) =>
        `<span class="star" style="left:${s.x}%;top:${s.y}%;animation-delay:${s.delay}s"></span>`
      ).join('')}</div>
      <header class="header fade-in">
        <span class="logo">⚡ CYBER</span>
        <h1 class="title gradient-text">今日赛博运势</h1>
        <p class="slogan">宇宙服务器今日已同步你的幸运值</p>
      </header>
      <section class="ball-section">
        <div class="ball-wrap" id="fortune-ball">
          <div class="particles">${Array.from({ length: 12 }, (_, i) =>
            `<span class="particle" style="left:${10 + Math.random() * 80}%;top:${10 + Math.random() * 80}%;animation-delay:${Math.random() * 2}s"></span>`
          ).join('')}</div>
          <div class="ball" id="ball">
            <div class="ball-inner">
              <div class="ball-glow"></div>
              <span class="ball-text">${homeState.hasOfficialToday ? '✨ 点击查看今日运势' : '✨ 点击获取今日运势'}</span>
            </div>
          </div>
        </div>
      </section>
      <div class="actions fade-in">
        ${homeState.hasOfficialToday ? '<button class="glass-btn" id="btn-view">查看今日结果</button>' : ''}
        ${homeState.hasOfficialToday ? '<button class="glass-btn ghost" id="btn-regen">娱乐重抽</button>' : ''}
      </div>
      <div class="loading-mask" id="loading-mask" hidden>
        <span class="loading-text">宇宙 WiFi 连接中...</span>
      </div>
    </div>
  `

  document.getElementById('fortune-ball')?.addEventListener('click', onBallTap)
  document.getElementById('btn-view')?.addEventListener('click', () => navigate('result'))
  document.getElementById('btn-regen')?.addEventListener('click', onRegenerate)
}

async function onBallTap() {
  if (homeState.loading) return
  if (homeState.hasOfficialToday) { navigate('result'); return }
  await startGenerate(false)
}

async function onRegenerate() {
  if (homeState.loading) return
  const ok = await showConfirm('娱乐重抽', '娱乐模式不计入正式运势，确定重抽？')
  if (ok) await startGenerate(true)
}

async function startGenerate(isEntertainment) {
  homeState.loading = true
  homeState.animating = true
  const ball = document.getElementById('ball')
  const mask = document.getElementById('loading-mask')
  ball?.classList.add('animating')
  mask?.removeAttribute('hidden')

  setTimeout(() => {
    homeState.exploding = true
    ball?.classList.add('exploding')
    if (!document.getElementById('explosion-ring')) {
      const ring = document.createElement('div')
      ring.id = 'explosion-ring'
      ring.className = 'explosion-ring'
      document.getElementById('fortune-ball')?.appendChild(ring)
    }
  }, 1200)

  try {
    await fortune.generateAndSave(isEntertainment)
    setTimeout(() => {
      homeState.animating = false
      homeState.exploding = false
      homeState.loading = false
      if (!isEntertainment) homeState.hasOfficialToday = true
      navigate('result')
    }, 2000)
  } catch (err) {
    homeState = { ...homeState, animating: false, exploding: false, loading: false }
    mask?.setAttribute('hidden', '')
    showToast(err.message || '生成失败')
    renderHome()
  }
}

/* ── Result ── */
async function renderResult() {
  const f = state.getCurrentFortune()
  if (!f) {
    showToast('暂无运势数据')
    setTimeout(() => navigate('home'), 1200)
    return
  }

  const userInfo = state.getUserInfo()
  const color = levelColor(f.level)
  const stars = scoreToStars(f.score)

  appEl.innerHTML = `
    <div class="result-wrap">
      <div class="ssr-flash" id="ssr-flash" hidden></div>
      <div class="result-page">
        <button class="back-btn" id="back-home">← 返回</button>
        <section class="score-section stagger-show">
          <span class="score-label">今日幸运指数</span>
          <div class="stars-row">${renderStars(stars)}</div>
          <div class="score-num-wrap">
            <span class="score-num gradient-text score-shimmer" id="score-num">0%</span>
          </div>
          <span class="score-level level-badge" style="color:${color};border-color:${color}">${escapeHtml(f.level)}</span>
        </section>
        <div class="stagger-show" style="animation-delay:0.13s">
          <div class="fortune-card glass-card">
            <span class="card-label">今日总结</span>
            <p class="card-summary">${escapeHtml(f.summary)}</p>
            <p class="card-fortune">${escapeHtml(f.fortune)}</p>
            <div class="card-keywords">${renderTags(f.keywords)}</div>
          </div>
        </div>
        <div class="stagger-show" style="animation-delay:0.26s">
          <div class="energy-bar glass-card">
            <div class="energy-header">
              <span class="energy-label">Cyber Energy</span>
              <span class="energy-value" id="energy-val">0%</span>
            </div>
            <div class="energy-track"><div class="energy-fill" id="energy-fill" style="width:0%"></div></div>
          </div>
        </div>
        <div class="stagger-show" style="animation-delay:0.39s">${renderBuffGrid(f.buff)}</div>
        <div class="avoid-card glass-card stagger-show" style="animation-delay:0.52s">
          <h3 class="section-title">今日避雷</h3>
          <div class="avoid-list">${(f.avoid || []).map((a) => `<span class="avoid-item">✗ ${escapeHtml(a)}</span>`).join('')}</div>
        </div>
        <div class="quote-card glass-card stagger-show" style="animation-delay:0.65s">
          <h3 class="section-title">AI 毒鸡汤</h3>
          <p class="quote-text">"${escapeHtml(f.oneLine)}"</p>
        </div>
        <div class="badge stagger-show" style="animation-delay:0.78s;border-color:${color}">
          <span class="badge-icon">🏅</span>
          <span class="badge-title">${escapeHtml(f.title)}</span>
          <span class="badge-level">${escapeHtml(f.level)}</span>
        </div>
        <div class="btn-row stagger-show" style="animation-delay:0.91s">
          <button class="glass-btn" id="btn-copy">复制分享文案</button>
          <button class="glass-btn ghost" id="back-home2">返回首页</button>
        </div>
      </div>
    </div>
  `

  document.getElementById('back-home')?.addEventListener('click', () => navigate('home'))
  document.getElementById('back-home2')?.addEventListener('click', () => navigate('home'))
  document.getElementById('btn-copy')?.addEventListener('click', () => copyShare(f, userInfo))

  const scoreEl = document.getElementById('score-num')
  const energyVal = document.getElementById('energy-val')
  const energyFill = document.getElementById('energy-fill')

  animateNumber(null, 0, f.score, 1200, (v) => {
    if (scoreEl) scoreEl.textContent = v + '%'
  })
  animateNumber(null, 0, f.fishIndex, 1000, (v) => {
    if (energyVal) energyVal.textContent = v + '%'
    if (energyFill) energyFill.style.width = v + '%'
  })

  if (f.level === 'SSR') {
    const flash = document.getElementById('ssr-flash')
    setTimeout(() => { flash?.removeAttribute('hidden') }, 300)
    setTimeout(() => flash?.setAttribute('hidden', ''), 1300)
  }
}

function copyShare(f, userInfo) {
  const text = [
    `【今日赛博运势】${userInfo.nickname || '赛博旅人'}`,
    `幸运值 ${f.score}% · ${f.level} · ${f.title}`,
    f.summary,
    `毒鸡汤：${f.oneLine}`,
  ].join('\n')
  navigator.clipboard.writeText(text)
    .then(() => showToast('已复制到剪贴板'))
    .catch(() => showToast('复制失败，请手动复制'))
}

/* ── History ── */
async function renderHistory() {
  appEl.innerHTML = `<div class="page container"><h1 class="page-title gradient-text">近 30 天运势</h1><div class="empty">加载中...</div></div>`

  const items = await fortune.getHistory(state.getUserId())
  if (!items.length) {
    appEl.innerHTML = `
      <div class="page container history-page">
        <h1 class="page-title gradient-text">近 30 天运势</h1>
        <div class="empty glass-card">
          <p>暂无历史记录</p>
          <button class="glass-btn" id="go-home">去抽签</button>
        </div>
      </div>
    `
    document.getElementById('go-home')?.addEventListener('click', () => navigate('home'))
    return
  }

  appEl.innerHTML = `
    <div class="page container history-page">
      <h1 class="page-title gradient-text">近 30 天运势</h1>
      <div class="timeline">
        ${items.map((item, i) => `
          <div class="timeline-item glass-card fade-in" data-index="${i}">
            <div class="item-date">${escapeHtml(formatDisplay(item.fortune_date))}</div>
            <div class="item-body">
              <span class="item-score" style="color:${levelColor(item.level)}">${item.score}%</span>
              <span class="item-level">${escapeHtml(item.level)} · ${escapeHtml(item.title)}</span>
              <span class="item-summary">${escapeHtml(item.summary)}</span>
            </div>
            <span class="item-arrow">›</span>
          </div>
        `).join('')}
      </div>
    </div>
  `

  appEl.querySelectorAll('.timeline-item').forEach((el) => {
    el.addEventListener('click', () => {
      const item = items[Number(el.dataset.index)]
      state.setCurrentFortune(item)
      navigate('result')
    })
  })
}

/* ── Ranking ── */
function buildPodium(top3) {
  if (!top3.length) return []
  if (top3.length === 1) return [{ ...top3[0], rank: 1, podiumClass: 'first solo' }]
  if (top3.length === 2) {
    return [
      { ...top3[1], rank: 2, podiumClass: 'second' },
      { ...top3[0], rank: 1, podiumClass: 'first' },
    ]
  }
  const order = [top3[1], top3[0], top3[2]]
  const classes = ['second', 'first', 'third']
  return order.map((item, idx) => ({
    ...item,
    rank: idx === 1 ? 1 : idx === 0 ? 2 : 3,
    podiumClass: classes[idx],
  }))
}

function formatUpdatedAt() {
  const d = new Date()
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' 更新'
}

async function renderRanking(force = false) {
  appEl.innerHTML = `
    <div class="page container ranking-page">
      <h1 class="page-title gradient-text">今日欧皇榜</h1>
      <div class="page-head">
        <span class="page-sub">按今日幸运值排序 · TOP100</span>
        <span class="updated-at" id="updated-at"></span>
      </div>
      <div class="empty">加载中...</div>
    </div>
  `

  const myId = state.getUserId()
  const items = await fortune.getRanking({ force })
  const list = items.map((item, i) => ({
    ...item,
    rank: i + 1,
    levelColor: levelColor(item.level),
    isMe: !!(myId && item.openid === myId),
  }))

  const myRankItem = list.find((item) => item.isMe)
  const podium = buildPodium(list.slice(0, 3))
  const restList = list.length > 3 ? list.slice(3) : []

  if (!list.length) {
    appEl.innerHTML = `
      <div class="page container ranking-page">
        <h1 class="page-title gradient-text">今日欧皇榜</h1>
        <div class="page-head"><span class="page-sub">按今日幸运值排序 · TOP100</span></div>
        <div class="empty-card glass-card">
          <span class="empty-icon">👑</span>
          <h2 class="empty-title">今日欧皇榜虚位以待</h2>
          <p class="empty-desc">完成正式抽签即可上榜</p>
          <button class="glass-btn" id="go-draw">去抽签</button>
        </div>
      </div>
    `
    document.getElementById('go-draw')?.addEventListener('click', () => navigate('home'))
    return
  }

  appEl.innerHTML = `
    <div class="page container ranking-page">
      <h1 class="page-title gradient-text">今日欧皇榜</h1>
      <div class="page-head">
        <span class="page-sub">按今日幸运值排序 · TOP100</span>
        <span class="updated-at">${formatUpdatedAt()}</span>
      </div>
      <div class="stats-bar glass-card fade-in">
        <div class="stat-cell"><span class="stat-val">${list.length}</span><span class="stat-key">今日参战</span></div>
        <div class="stat-cell"><span class="stat-val gradient-text">${list[0].score}%</span><span class="stat-key">最高幸运值</span></div>
        <div class="stat-cell"><span class="stat-val">${myRankItem ? myRankItem.rank : '-'}</span><span class="stat-key">我的排名</span></div>
      </div>
      <div class="podium-section">
        ${podium.map((item) => `
          <div class="podium-item ${item.podiumClass} ${item.isMe ? 'is-me' : ''}">
            ${item.rank === 1 ? '<span class="podium-crown">👑</span>' : ''}
            <span class="level-tag" style="color:${item.levelColor};border-color:${item.levelColor}">${escapeHtml(item.level)}</span>
            <img class="podium-avatar" src="${escapeHtml(item.avatar_url || DEFAULT_AVATAR)}" alt="" />
            <span class="podium-rank">NO.${item.rank}</span>
            <span class="podium-name">${escapeHtml(item.nickname)}${item.isMe ? ' (我)' : ''}</span>
            <span class="podium-score">${item.score}%</span>
            <span class="podium-ssr">累计 SSR ×${item.ssrCount || 0}</span>
            <div class="podium-bar"></div>
          </div>
        `).join('')}
      </div>
      ${restList.length ? `
        <div class="rank-list">
          ${restList.map((item) => `
            <div class="rank-item glass-card fade-in ${item.isMe ? 'is-me' : ''}">
              <span class="rank-no">${item.rank}</span>
              <img class="rank-avatar" src="${escapeHtml(item.avatar_url || DEFAULT_AVATAR)}" alt="" />
              <div class="rank-info">
                <div class="name-row">
                  <span class="rank-name">${escapeHtml(item.nickname)}</span>
                  ${item.isMe ? '<span class="me-tag">我</span>' : ''}
                </div>
                <span class="rank-meta">${escapeHtml(item.title)}</span>
              </div>
              <div class="rank-right">
                <span class="level-pill" style="color:${item.levelColor}">${escapeHtml(item.level)}</span>
                <span class="rank-score">${item.score}%</span>
                <span class="rank-ssr">SSR ×${item.ssrCount || 0}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <p class="rank-tip">下拉刷新榜单 · 仅正式签计入排名</p>
      ${myRankItem && myRankItem.rank > 8 ? `
        <div class="my-rank-bar glass-card">
          <span class="my-rank-no">#${myRankItem.rank}</span>
          <img class="my-rank-avatar" src="${escapeHtml(myRankItem.avatar_url || DEFAULT_AVATAR)}" alt="" />
          <div class="my-rank-info">
            <span class="my-rank-name">我的排名</span>
            <span class="my-rank-meta">${escapeHtml(myRankItem.title)}</span>
          </div>
          <span class="my-rank-score">${myRankItem.score}%</span>
        </div>
      ` : ''}
    </div>
  `

  if (!rankingRefreshBound) {
    rankingRefreshBound = true
    let startY = 0
    window.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY }, { passive: true })
    window.addEventListener('touchend', async (e) => {
      if (getRoute() !== 'ranking') return
      const diff = e.changedTouches[0].clientY - startY
      if (window.scrollY === 0 && diff > 80) {
        fortune.invalidateRankingCache()
        await renderRanking(true)
        showToast('榜单已刷新')
      }
    }, { passive: true })
  }
}

/* ── Profile ── */
async function renderProfile() {
  const userInfo = state.getUserInfo()
  const avatar = userInfo.avatarUrl || AVATAR_PRESETS[0]
  let profile = await fortune.getUserProfile(state.getUserId()) || {
    badges: [], totalDraws: 0, maxScore: 0, avgScore: 0, ssrCount: 0, checkInStreak: 0, points: 0,
  }

  appEl.innerHTML = `
    <div class="page container profile-page">
      <div class="user-card glass-card fade-in">
        <button class="avatar-btn" id="avatar-btn" type="button">
          <img class="avatar" src="${escapeHtml(avatar)}" alt="头像" />
        </button>
        <input class="nickname-input" id="nickname" placeholder="输入昵称" value="${escapeHtml(userInfo.nickname || '')}" />
        <p class="avatar-hint">点击头像切换 · 昵称自动保存</p>
      </div>
      <div class="stats-grid">
        <div class="stat-item glass-card"><span class="stat-num">${profile.totalDraws}</span><span class="stat-label">累计抽签</span></div>
        <div class="stat-item glass-card"><span class="stat-num gradient-text">${profile.maxScore}</span><span class="stat-label">最高幸运值</span></div>
        <div class="stat-item glass-card"><span class="stat-num">${profile.avgScore}</span><span class="stat-label">平均幸运值</span></div>
        <div class="stat-item glass-card"><span class="stat-num">${profile.ssrCount}</span><span class="stat-label">SSR 次数</span></div>
      </div>
      <div class="checkin-card glass-card fade-in">
        <div class="checkin-row">
          <h3 class="section-title">连续签到</h3>
          <span class="checkin-days">${profile.checkInStreak} 天</span>
        </div>
        <span class="checkin-points">积分：${profile.points}</span>
        <button class="glass-btn" id="btn-checkin">今日签到</button>
      </div>
      ${profile.badges.length ? `
        <div class="badges-section glass-card fade-in">
          <h3 class="section-title">获得徽章</h3>
          <div class="badge-list">${profile.badges.map((b) => `<span class="badge-tag">🏅 ${escapeHtml(b)}</span>`).join('')}</div>
        </div>
      ` : ''}
    </div>
  `

  let avatarIdx = AVATAR_PRESETS.indexOf(avatar)
  if (avatarIdx < 0) avatarIdx = 0

  document.getElementById('avatar-btn')?.addEventListener('click', () => {
    avatarIdx = (avatarIdx + 1) % AVATAR_PRESETS.length
    const url = AVATAR_PRESETS[avatarIdx]
    state.updateUserInfo({ ...state.getUserInfo(), avatarUrl: url })
    document.querySelector('.avatar').src = url
    showToast('头像已更新')
  })

  document.getElementById('nickname')?.addEventListener('change', (e) => {
    state.updateUserInfo({ ...state.getUserInfo(), nickname: e.target.value || '赛博旅人' })
  })

  document.getElementById('btn-checkin')?.addEventListener('click', async () => {
    const res = await fortune.doCheckIn(state.getUserId())
    if (res.success) {
      showToast(`连续 ${res.streak} 天 · 积分 ${res.points}`)
      renderProfile()
    } else {
      showToast(res.msg || '签到失败')
    }
  })
}

/* ── Init ── */
bindTabBar()
window.addEventListener('hashchange', router)
router()