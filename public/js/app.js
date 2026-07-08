import * as fortune from './fortune.js'
import * as state from './state.js'
import * as storage from './storage.js'
import { formatDisplay, today, daysAgo, shiftDate, RANKING_HISTORY_DAYS } from './date.js'
import { animateNumber, scoreToStars, levelColor } from './animation.js'
import {
  escapeHtml, showToast, showConfirm, DEFAULT_AVATAR, AVATAR_PRESETS,
  renderBuffGrid, renderTags, renderStars,
} from './ui.js'
import {
  wrapPage, renderPageHeader, renderCyberLoader, renderMarquee,
  renderStatChips, renderNeonCard, rankMedal, levelBadgeClass,
  initTabIcons, spawnParticles,
} from './chrome.js'
import { FortuneLoadingRitual } from './loading-ritual.js'

const appEl = document.getElementById('app')
const tabBar = document.getElementById('tab-bar')
const TABS = ['home', 'history', 'ranking', 'profile']

let homeState = { loading: false, animating: false, exploding: false, hasOfficialToday: false }
let activeRitual = null
let rankingRefreshBound = false
let rankingSelectedDate = today()
let sessionReady = false

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

function setShellVisible(showMain) {
  tabBar.style.display = showMain ? 'flex' : 'none'
  const statusBar = document.querySelector('.status-bar')
  if (statusBar) statusBar.style.display = showMain ? 'flex' : 'none'
}

function renderOnboarding() {
  setShellVisible(false)
  appEl.classList.add('full-height')
  const avatar = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)]

  appEl.innerHTML = wrapPage(`
    <div class="onboard-page">
      ${renderPageHeader({ chip: 'WELCOME', title: '请先输入昵称' })}
      <div class="onboard-card neon-card glass-card fade-in">
        <span class="corner tl"></span><span class="corner tr"></span>
        <span class="corner bl"></span><span class="corner br"></span>
        <div class="onboard-avatar-wrap">
          <img class="onboard-avatar" id="onboard-avatar" src="${escapeHtml(avatar)}" alt="" />
          <button type="button" class="onboard-avatar-btn" id="onboard-avatar-btn">换头像</button>
        </div>
        <label class="onboard-label" for="onboard-name">你的赛博用户名</label>
        <input
          class="onboard-input"
          id="onboard-name"
          type="text"
          maxlength="16"
          placeholder="2-16 个字符，例如：欧皇小明"
          autocomplete="nickname"
        />
        <p class="onboard-hint" id="onboard-hint">昵称仅用于本次访问的排行榜与运势展示</p>
        <button type="button" class="glass-btn" id="onboard-submit">进入赛博运势</button>
      </div>
    </div>
  `, 'onboard-page')

  let avatarIdx = AVATAR_PRESETS.indexOf(avatar)
  if (avatarIdx < 0) avatarIdx = 0

  document.getElementById('onboard-avatar-btn')?.addEventListener('click', () => {
    avatarIdx = (avatarIdx + 1) % AVATAR_PRESETS.length
    document.getElementById('onboard-avatar').src = AVATAR_PRESETS[avatarIdx]
  })

  const submit = () => {
    const name = document.getElementById('onboard-name')?.value
    const result = storage.saveNickname(name, AVATAR_PRESETS[avatarIdx])
    if (!result.ok) {
      const hint = document.getElementById('onboard-hint')
      if (hint) {
        hint.textContent = result.msg
        hint.classList.add('onboard-error')
      }
      return
    }
    state.updateUserInfo({ nickname: result.nickname, avatarUrl: AVATAR_PRESETS[avatarIdx] })
    storage.getUserId()
    sessionReady = true
    showToast('欢迎，' + result.nickname)
    setShellVisible(true)
    router()
  }

  document.getElementById('onboard-submit')?.addEventListener('click', submit)
  document.getElementById('onboard-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit()
  })
}

async function router() {
  if (!sessionReady) {
    renderOnboarding()
    return
  }

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

  const homeInner = `
    <div class="home-page">
      <div class="bg-gradient"></div>
      <div class="stars">${stars.map((s) =>
        `<span class="star" style="left:${s.x}%;top:${s.y}%;animation-delay:${s.delay}s"></span>`
      ).join('')}</div>
      <header class="header fade-in">
        <span class="logo">⚡ CYBER FORTUNE v2.0</span>
        <h1 class="title gradient-text">今日赛博运势</h1>
        <p class="slogan">宇宙服务器今日已同步你的幸运值</p>
      </header>
      ${renderMarquee(['AI 运势已上线', '每日正式签计入欧皇榜', 'SSR 触发全屏金光', '娱乐重抽不计入排名', '连续签到赢徽章'])}
      ${renderStatChips([
        { icon: '🎲', value: homeState.hasOfficialToday ? '已抽' : '待抽', label: '今日状态' },
        { icon: '⚡', value: 'AI', label: 'Minimax 驱动' },
        { icon: '👑', value: 'TOP100', label: '欧皇竞技' },
      ])}
      <section class="ball-section">
        <div class="ball-wrap" id="fortune-ball">
          <div class="orbit-ring orbit-ring-1"><span class="orbit-dot"></span></div>
          <div class="orbit-ring orbit-ring-2"></div>
          <div class="particles" id="ball-particles"></div>
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

    </div>
  `
  appEl.innerHTML = homeInner
  spawnParticles(document.getElementById('ball-particles'), 18)

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
  const homePage = document.querySelector('.home-page')
  ball?.classList.add('animating')

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

  activeRitual?.destroy()
  activeRitual = new FortuneLoadingRitual().mount(homePage).start()

  try {
    await fortune.generateAndSave(isEntertainment)
    await activeRitual.complete()
    activeRitual = null
    homeState.animating = false
    homeState.exploding = false
    homeState.loading = false
    if (!isEntertainment) homeState.hasOfficialToday = true
    navigate('result')
  } catch (err) {
    activeRitual?.destroy()
    activeRitual = null
    homeState = { ...homeState, animating: false, exploding: false, loading: false }
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

  appEl.innerHTML = wrapPage(`
    <div class="result-wrap">
      <div class="ssr-flash" id="ssr-flash" hidden></div>
      <div class="result-page">
        <button class="back-btn" id="back-home">← 返回</button>
        <section class="score-section glass-card neon-card stagger-show">
          <span class="corner tl"></span><span class="corner tr"></span>
          <span class="corner bl"></span><span class="corner br"></span>
          <span class="score-label">今日幸运指数</span>
          <div class="stars-row">${renderStars(stars)}</div>
          <div class="score-num-wrap">
            <span class="score-num gradient-text score-shimmer" id="score-num">0%</span>
          </div>
          <span class="score-level level-badge" style="color:${color};border-color:${color}">${escapeHtml(f.level)}</span>
        </section>
        <div class="stagger-show" style="animation-delay:0.13s">
          ${renderNeonCard(`
            <div class="fortune-card-inner">
            <span class="card-label">今日总结</span>
            <p class="card-summary">${escapeHtml(f.summary)}</p>
            <p class="card-fortune">${escapeHtml(f.fortune)}</p>
            <div class="card-keywords">${renderTags(f.keywords)}</div>
            </div>
          `)}
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
  `, 'result-page')

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

function parseHistoryDate(dateStr) {
  const d = new Date(dateStr.replace(/-/g, '/'))
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return { day: String(d.getDate()).padStart(2, '0'), week: '周' + week }
}

/* ── History ── */
async function renderHistory() {
  appEl.innerHTML = wrapPage(
    renderPageHeader({ chip: 'ARCHIVE', title: '近 30 天运势', subtitle: '点击记录查看当日详情' })
    + renderCyberLoader('读取时空档案'),
    'history-page'
  )

  const items = await fortune.getHistory(state.getUserId())
  if (!items.length) {
    appEl.innerHTML = wrapPage(`
      ${renderPageHeader({ chip: 'ARCHIVE', title: '近 30 天运势', subtitle: '你的运势时光机' })}
      <div class="empty-card glass-card fade-in">
        <span class="empty-icon">📡</span>
        <h2 class="empty-title">时空档案为空</h2>
        <p class="empty-desc">完成首次正式抽签后，记录将在此显示</p>
        <button class="glass-btn" id="go-home">去抽签</button>
      </div>
    `, 'history-page')
    document.getElementById('go-home')?.addEventListener('click', () => navigate('home'))
    return
  }

  appEl.innerHTML = wrapPage(`
    ${renderPageHeader({ chip: 'ARCHIVE', title: '近 30 天运势', subtitle: `共 ${items.length} 条正式签记录` })}
    <div class="timeline">
      ${items.map((item, i) => {
        const dt = parseHistoryDate(item.fortune_date)
        const lc = levelColor(item.level)
        return `
          <div class="timeline-item fade-in" data-index="${i}" style="animation-delay:${i * 0.04}s">
            <div class="timeline-card glass-card">
              <div class="item-date-col">
                <span class="item-date-day">${dt.day}</span>
                <span class="item-date-week">${dt.week}</span>
              </div>
              <div class="item-body">
                <span class="item-score" style="color:${lc}">${item.score}%</span>
                <span class="item-level ${levelBadgeClass(item.level)}">${escapeHtml(item.level)}</span>
                <span class="item-title">${escapeHtml(item.title)}</span>
                <span class="item-summary">${escapeHtml(item.summary)}</span>
              </div>
              <span class="item-arrow">›</span>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `, 'history-page')

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

function clampRankingDate(dateStr) {
  const min = daysAgo(RANKING_HISTORY_DAYS)
  const max = today()
  if (dateStr < min) return min
  if (dateStr > max) return max
  return dateStr
}

function buildRankingDateNav(date) {
  const minDate = daysAgo(RANKING_HISTORY_DAYS)
  const isToday = date === today()
  const canPrev = date > minDate
  const canNext = date < today()
  return `
    <div class="rank-date-nav glass-card">
      <button type="button" class="date-nav-btn" id="rank-prev" ${canPrev ? '' : 'disabled'} aria-label="前一天">‹</button>
      <label class="rank-date-label">
        <span class="rank-date-text">${escapeHtml(formatDisplay(date))}</span>
        <input type="date" class="rank-date-input" id="rank-date-pick" value="${date}" min="${minDate}" max="${today()}" />
      </label>
      <button type="button" class="date-nav-btn" id="rank-next" ${canNext ? '' : 'disabled'} aria-label="后一天">›</button>
    </div>
    ${!isToday ? '<button type="button" class="rank-today-btn" id="rank-today">回到今日</button>' : ''}
  `
}

function bindRankingDateNav(date) {
  document.getElementById('rank-prev')?.addEventListener('click', () => {
    changeRankingDate(shiftDate(date, -1))
  })
  document.getElementById('rank-next')?.addEventListener('click', () => {
    changeRankingDate(shiftDate(date, 1))
  })
  document.getElementById('rank-today')?.addEventListener('click', () => {
    changeRankingDate(today())
  })
  document.getElementById('rank-date-pick')?.addEventListener('change', (e) => {
    changeRankingDate(e.target.value)
  })
}

async function changeRankingDate(newDate) {
  rankingSelectedDate = clampRankingDate(newDate)
  await renderRanking(false, rankingSelectedDate)
}

function getRankingCopy(date) {
  const isToday = date === today()
  return {
    title: isToday ? '今日欧皇榜' : '历史欧皇榜',
    sub: isToday ? '按今日幸运值排序 · TOP100' : `${formatDisplay(date)} · TOP100`,
    statKey: isToday ? '今日参战' : '当日参战',
    emptyTitle: isToday ? '今日欧皇榜虚位以待' : '该日欧皇榜暂无数据',
    emptyDesc: isToday ? '完成正式抽签即可上榜' : '当日无人完成正式抽签',
    showDrawBtn: isToday,
  }
}

async function renderRanking(force = false, date = rankingSelectedDate) {
  rankingSelectedDate = clampRankingDate(date)
  const copy = getRankingCopy(rankingSelectedDate)

  appEl.innerHTML = wrapPage(`
    ${renderPageHeader({ chip: 'LEADERBOARD', title: copy.title, subtitle: copy.sub })}
    ${buildRankingDateNav(rankingSelectedDate)}
    ${renderCyberLoader('同步欧皇数据')}
  `, 'ranking-page')
  bindRankingDateNav(rankingSelectedDate)

  const myId = state.getUserId()
  const items = await fortune.getRanking({ force, date: rankingSelectedDate })
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
    appEl.innerHTML = wrapPage(`
      ${renderPageHeader({ chip: 'LEADERBOARD', title: copy.title, subtitle: copy.sub })}
      ${buildRankingDateNav(rankingSelectedDate)}
      <div class="empty-card glass-card fade-in">
        <span class="empty-icon">👑</span>
        <h2 class="empty-title">${copy.emptyTitle}</h2>
        <p class="empty-desc">${copy.emptyDesc}</p>
        ${copy.showDrawBtn ? '<button class="glass-btn" id="go-draw">去抽签</button>' : ''}
      </div>
    `, 'ranking-page')
    bindRankingDateNav(rankingSelectedDate)
    document.getElementById('go-draw')?.addEventListener('click', () => navigate('home'))
    return
  }

  appEl.innerHTML = wrapPage(`
    ${renderPageHeader({ chip: 'LEADERBOARD', title: copy.title, subtitle: copy.sub })}
    ${buildRankingDateNav(rankingSelectedDate)}
    <div class="page-head"><span></span><span class="updated-at">${formatUpdatedAt()}</span></div>
    <div class="stats-bar glass-card fade-in">
      <div class="stat-cell"><span class="stat-val">${list.length}</span><span class="stat-key">${copy.statKey}</span></div>
      <div class="stat-cell"><span class="stat-val gradient-text">${list[0].score}%</span><span class="stat-key">最高幸运值</span></div>
      <div class="stat-cell"><span class="stat-val">${myRankItem ? myRankItem.rank : '-'}</span><span class="stat-key">我的排名</span></div>
    </div>
    <div class="podium-section">
      ${podium.map((item) => `
        <div class="podium-item ${item.podiumClass} ${item.isMe ? 'is-me' : ''}">
          <span class="podium-medal">${rankMedal(item.rank) || (item.rank === 1 ? '👑' : '')}</span>
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
        ${restList.map((item, idx) => `
          <div class="rank-item glass-card fade-in ${item.isMe ? 'is-me' : ''}" style="animation-delay:${idx * 0.03}s">
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
    <p class="rank-tip">左右切换日期查看近 ${RANKING_HISTORY_DAYS} 天榜单 · 下拉刷新</p>
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
  `, 'ranking-page')
  bindRankingDateNav(rankingSelectedDate)

  if (!rankingRefreshBound) {
    rankingRefreshBound = true
    let startY = 0
    window.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY }, { passive: true })
    window.addEventListener('touchend', async (e) => {
      if (getRoute() !== 'ranking') return
      const diff = e.changedTouches[0].clientY - startY
      if (window.scrollY === 0 && diff > 80) {
        fortune.invalidateRankingCache()
        await renderRanking(true, rankingSelectedDate)
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

  const xpPct = Math.min(100, Math.round((profile.points % 100)))
  appEl.innerHTML = wrapPage(`
    ${renderPageHeader({ chip: 'PROFILE', title: '赛博旅人档案', subtitle: '你的运势数据中枢' })}
    <div class="user-card glass-card fade-in">
      <div class="avatar-wrap">
        <div class="avatar-ring"></div>
        <button class="avatar-btn" id="avatar-btn" type="button">
          <img class="avatar" src="${escapeHtml(avatar)}" alt="头像" />
        </button>
      </div>
      <input class="nickname-input" id="nickname" placeholder="输入昵称" value="${escapeHtml(userInfo.nickname || '')}" />
      <p class="avatar-hint">点击头像切换 · 昵称自动保存</p>
      <div class="xp-bar-wrap">
        <div class="xp-label"><span>积分等级</span><span>${profile.points} PT</span></div>
        <div class="xp-track"><div class="xp-fill" style="width:${xpPct}%"></div></div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-item glass-card fade-in"><span class="stat-icon">🎲</span><span class="stat-num">${profile.totalDraws}</span><span class="stat-label">累计抽签</span></div>
      <div class="stat-item glass-card fade-in"><span class="stat-icon">⚡</span><span class="stat-num gradient-text">${profile.maxScore}</span><span class="stat-label">最高幸运值</span></div>
      <div class="stat-item glass-card fade-in"><span class="stat-icon">📊</span><span class="stat-num">${profile.avgScore}</span><span class="stat-label">平均幸运值</span></div>
      <div class="stat-item glass-card fade-in"><span class="stat-icon">✨</span><span class="stat-num">${profile.ssrCount}</span><span class="stat-label">SSR 次数</span></div>
    </div>
    <div class="checkin-card glass-card fade-in">
      <div class="checkin-row">
        <h3 class="section-title">连续签到</h3>
        <span class="checkin-days">${profile.checkInStreak} 天</span>
      </div>
      <span class="checkin-points">当前积分 ${profile.points} · 签到 +10</span>
      <button class="glass-btn" id="btn-checkin">今日签到</button>
    </div>
    ${profile.badges.length ? `
      <div class="badges-section glass-card fade-in">
        <h3 class="section-title">获得徽章</h3>
        <div class="badge-list">${profile.badges.map((b) => `<span class="badge-tag">🏅 ${escapeHtml(b)}</span>`).join('')}</div>
      </div>
    ` : ''}
  `, 'profile-page')

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
    const check = storage.validateNickname(e.target.value)
    if (!check.ok) {
      showToast(check.msg)
      return
    }
    state.updateUserInfo({ ...state.getUserInfo(), nickname: check.value })
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

function updateStatusClock() {
  const el = document.getElementById('status-time')
  if (!el) return
  const d = new Date()
  el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

/* ── Init ── */
initTabIcons()
bindTabBar()
updateStatusClock()
setInterval(updateStatusClock, 30000)
window.addEventListener('hashchange', router)
renderOnboarding()