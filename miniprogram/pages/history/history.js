const fortuneService = require('../../services/fortune.js')
const { formatDisplay } = require('../../utils/date.js')
const { levelColor } = require('../../utils/animation.js')

Page({
  data: { list: [], loading: true },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadHistory()
  },

  loadHistory() {
    const app = getApp()
    const userId = app.globalData.userId
    if (!userId) {
      this.setData({ list: [], loading: false })
      return
    }
    this.setData({ loading: true })
    fortuneService.getHistory(userId).then((items) => {
      const list = (items || []).map((item) => ({
        ...item,
        displayDate: formatDisplay(item.fortune_date),
        color: levelColor(item.level),
      }))
      this.setData({ list, loading: false })
    })
  },

  onItemTap(e) {
    const item = this.data.list[e.currentTarget.dataset.index]
    getApp().setCurrentFortune(item)
    wx.navigateTo({ url: '/pages/result/result' })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },
})