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
]

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
  STAGES.forEach((s) => { if (pct >= s.threshold) current = s })
  return current
}

function createRitualState() {
  return {
    ritualVisible: false,
    ritualTitle: STAGES[0].title,
    ritualMsg: STAGES[0].msg,
    ritualProgress: 0,
    ritualPct: 0,
    ritualFlavor: FLAVORS[0],
    ritualStage: 'STEP 1/' + STAGES.length,
    ritualElapsed: '0s',
    ritualStep: 0,
    ritualSuccess: false,
    ritualSteps: STAGES.length,
  }
}

function tickRitual(ctx, startedAt, flavorIdx) {
  const elapsed = Date.now() - startedAt
  const progress = easeProgress(elapsed)
  const stage = stageForProgress(progress)
  const stageIdx = STAGES.indexOf(stage)
  return {
    ritualTitle: stage.title,
    ritualMsg: stage.msg,
    ritualProgress: progress,
    ritualPct: Math.floor(progress),
    ritualStage: 'STEP ' + (stageIdx + 1) + '/' + STAGES.length,
    ritualElapsed: Math.floor(elapsed / 1000) + 's',
    ritualStep: stageIdx,
    flavorIdx,
  }
}

function startRitual(page) {
  const state = createRitualState()
  state.ritualVisible = true
  page.setData(state)

  const startedAt = Date.now()
  let flavorIdx = 0

  page._ritualTick = setInterval(() => {
    const next = tickRitual(page, startedAt, flavorIdx)
    page.setData({
      ritualTitle: next.ritualTitle,
      ritualMsg: next.ritualMsg,
      ritualProgress: next.ritualProgress,
      ritualPct: next.ritualPct,
      ritualStage: next.ritualStage,
      ritualElapsed: next.ritualElapsed,
      ritualStep: next.ritualStep,
    })
  }, 120)

  page._ritualFlavor = setInterval(() => {
    flavorIdx = (flavorIdx + 1) % FLAVORS.length
    page.setData({ ritualFlavor: FLAVORS[flavorIdx] })
  }, 2800)

  page._ritualStartedAt = startedAt
  return startedAt
}

function stopRitualTimers(page) {
  if (page._ritualTick) clearInterval(page._ritualTick)
  if (page._ritualFlavor) clearInterval(page._ritualFlavor)
  page._ritualTick = null
  page._ritualFlavor = null
}

function completeRitual(page) {
  const MIN_MS = 2600
  const startedAt = page._ritualStartedAt || Date.now()
  const wait = Math.max(0, MIN_MS - (Date.now() - startedAt))

  return new Promise((resolve) => {
    setTimeout(() => {
      stopRitualTimers(page)
      page.setData({
        ritualSuccess: true,
        ritualTitle: '✨ 运势降临',
        ritualMsg: '今日赛博签文已生成，欧皇请查收',
        ritualFlavor: '🎉 即将为你揭晓…',
        ritualProgress: 100,
        ritualPct: 100,
      })
      setTimeout(() => {
        page.setData({ ritualVisible: false, ritualSuccess: false })
        resolve()
      }, 700)
    }, wait)
  })
}

function cancelRitual(page) {
  stopRitualTimers(page)
  page.setData({ ritualVisible: false, ritualSuccess: false })
}

module.exports = {
  STAGES,
  FLAVORS,
  createRitualState,
  startRitual,
  completeRitual,
  cancelRitual,
}