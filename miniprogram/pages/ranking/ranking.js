const fortuneService = require('../../services/fortune.js')
const { levelColor } = require('../../utils/animation.js')
const {
  today,
  daysAgo,
  shiftDate,
  formatDisplay,
  RANKING_HISTORY_DAYS,
} = require('../../utils/date.js')

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

const PODIUM_CLASS = ['second', 'first', 'third']

function clampRankingDate(dateStr) {
  const min = daysAgo(RANKING_HISTORY_DAYS)
  const max = today()
  if (dateStr < min) return min
  if (dateStr > max) return max
  return dateStr
}

function buildPodium(top3) {
  if (!top3.length) return []
  if (top3.length === 1) {
    return [{ ...top3[0], rank: 1, podiumClass: 'first solo' }]
  }
  if (top3.length === 2) {
    return [
      { ...top3[1], rank: 2, podiumClass: 'second' },
      { ...top3[0], rank: 1, podiumClass: 'first' },
    ]
  }
  const order = [top3[1], top3[0], top3[2]]
  return order.map((item, idx) => ({
    ...item,
    rank: idx === 1 ? 1 : idx === 0 ? 2 : 3,
    podiumClass: PODIUM_CLASS[idx],
  }))
}

function enrichItem(item, myId) {
  return {
    ...item,
    levelColor: levelColor(item.level),
    isMe: !!(myId && item.openid === myId),
  }
}

function formatUpdatedAt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return h + ':' + m + ' 更新'
}

function getRankingCopy(date) {
  const isToday = date === today()
  return {
    pageTitle: isToday ? '今日欧皇榜' : '历史欧皇榜',
    pageSub: isToday ? '按今日幸运值排序 · TOP100' : formatDisplay(date) + ' · TOP100',
    statKey: isToday ? '今日参战' : '当日参战',
    emptyTitle: isToday ? '今日欧皇榜虚位以待' : '该日欧皇榜暂无数据',
    emptyDesc: isToday ? '完成正式抽签即可上榜' : '当日无人完成正式抽签',
    showDrawBtn: isToday,
  }
}

function buildDateMeta(date) {
  const minDate = daysAgo(RANKING_HISTORY_DAYS)
  return {
    selectedDate: date,
    dateDisplay: formatDisplay(date),
    isToday: date === today(),
    canPrev: date > minDate,
    canNext: date < today(),
    minDate,
    maxDate: today(),
  }
}

function applyRankingList(page, items, myId, date) {
  const list = (items || []).map((item, index) =>
    enrichItem({ ...item, rank: index + 1 }, myId)
  )
  const myRankItem = list.find((item) => item.isMe)
  const top3 = list.slice(0, 3)
  const podium = buildPodium(top3)
  const restList = list.length > 3 ? list.slice(3) : []
  const showMyBar = !!(myRankItem && myRankItem.rank > 8)
  const copy = getRankingCopy(date)

  page.setData({
    list,
    podium,
    restList,
    myRankItem: showMyBar ? myRankItem : null,
    topScore: list.length ? list[0].score : 0,
    myRank: myRankItem ? myRankItem.rank : 0,
    loading: false,
    updatedAtText: formatUpdatedAt(Date.now()),
    statKey: copy.statKey,
    emptyTitle: copy.emptyTitle,
    emptyDesc: copy.emptyDesc,
    showDrawBtn: copy.showDrawBtn,
    pageTitle: copy.pageTitle,
    pageSub: copy.pageSub,
    ...buildDateMeta(date),
  })
}

Page({
  data: {
    list: [],
    podium: [],
    restList: [],
    myRankItem: null,
    loading: true,
    defaultAvatar: DEFAULT_AVATAR,
    topScore: 0,
    myRank: 0,
    updatedAtText: '',
    selectedDate: today(),
    dateDisplay: '',
    isToday: true,
    canPrev: false,
    canNext: false,
    minDate: daysAgo(RANKING_HISTORY_DAYS),
    maxDate: today(),
    pageTitle: '今日欧皇榜',
    pageSub: '按今日幸运值排序 · TOP100',
    statKey: '今日参战',
    emptyTitle: '今日欧皇榜虚位以待',
    emptyDesc: '完成正式抽签即可上榜',
    showDrawBtn: true,
    historyDays: RANKING_HISTORY_DAYS,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadRanking()
  },

  loadRanking(force, date) {
    const selectedDate = clampRankingDate(date || this.data.selectedDate)
    const myId = getApp().globalData.userId
    const copy = getRankingCopy(selectedDate)

    if (!this.data.list.length || force) {
      this.setData({
        loading: true,
        selectedDate,
        ...buildDateMeta(selectedDate),
        pageTitle: copy.pageTitle,
        pageSub: copy.pageSub,
        statKey: copy.statKey,
        emptyTitle: copy.emptyTitle,
        emptyDesc: copy.emptyDesc,
        showDrawBtn: copy.showDrawBtn,
      })
    }

    return fortuneService.getRanking({ force: !!force, date: selectedDate }).then((items) => {
      applyRankingList(this, items, myId, selectedDate)
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  onPrevDate() {
    if (!this.data.canPrev) return
    this.loadRanking(false, shiftDate(this.data.selectedDate, -1))
  },

  onNextDate() {
    if (!this.data.canNext) return
    this.loadRanking(false, shiftDate(this.data.selectedDate, 1))
  },

  onDatePick(e) {
    const value = e.detail.value
    if (!value) return
    this.loadRanking(false, value)
  },

  goToday() {
    this.loadRanking(false, today())
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  onPullDownRefresh() {
    fortuneService.invalidateRankingCache()
    this.loadRanking(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },
})