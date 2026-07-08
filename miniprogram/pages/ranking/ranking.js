const fortuneService = require('../../services/fortune.js')
const { levelColor } = require('../../utils/animation.js')

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

const PODIUM_CLASS = ['second', 'first', 'third']

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

function applyRankingList(page, items, myId) {
  const list = (items || []).map((item, index) =>
    enrichItem({ ...item, rank: index + 1 }, myId)
  )
  const myRankItem = list.find((item) => item.isMe)
  const top3 = list.slice(0, 3)
  const podium = buildPodium(top3)
  const restList = list.length > 3 ? list.slice(3) : []
  const showMyBar = !!(myRankItem && myRankItem.rank > 8)

  page.setData({
    list,
    podium,
    restList,
    myRankItem: showMyBar ? myRankItem : null,
    topScore: list.length ? list[0].score : 0,
    myRank: myRankItem ? myRankItem.rank : 0,
    loading: false,
    updatedAtText: formatUpdatedAt(Date.now()),
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
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadRanking()
  },

  loadRanking(force) {
    const myId = getApp().globalData.userId
    if (!this.data.list.length || force) {
      this.setData({ loading: true })
    }

    return fortuneService.getRanking({ force: !!force }).then((items) => {
      applyRankingList(this, items, myId)
    }).catch(() => {
      this.setData({ loading: false })
    })
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