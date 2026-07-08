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

Page({
  data: {
    list: [],
    podium: [],
    restList: [],
    loading: true,
    defaultAvatar: DEFAULT_AVATAR,
    topScore: 0,
    myRank: 0,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadRanking()
  },

  loadRanking() {
    const myId = getApp().globalData.userId
    this.setData({ loading: true })
    fortuneService.getRanking().then((items) => {
      const list = (items || []).map((item, index) =>
        enrichItem({ ...item, rank: index + 1 }, myId)
      )
      const myRankItem = list.find((item) => item.isMe)
      const top3 = list.slice(0, 3)
      const podium = buildPodium(top3)
      const restList = list.length > 3 ? list.slice(3) : []
      this.setData({
        list,
        podium,
        restList,
        topScore: list.length ? list[0].score : 0,
        myRank: myRankItem ? myRankItem.rank : 0,
        loading: false,
      })
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  onPullDownRefresh() {
    this.loadRanking()
    wx.stopPullDownRefresh()
  },
})