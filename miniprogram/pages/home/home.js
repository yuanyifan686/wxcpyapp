const fortuneService = require('../../services/fortune.js')

Page({
  data: {
    stars: [],
    animating: false,
    exploding: false,
    loading: false,
    hasOfficialToday: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.initStars()
    this.checkToday()
  },

  initStars() {
    const stars = []
    for (let i = 0; i < 40; i++) {
      stars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 3,
      })
    }
    this.setData({ stars })
  },

  checkToday() {
    const app = getApp()
    const userId = app.globalData.userId
    fortuneService.checkTodayOfficial(userId).then((record) => {
      this.setData({ hasOfficialToday: !!record })
      if (record) app.setCurrentFortune(record)
    })
  },

  onBallTap() {
    if (this.data.loading) return
    if (this.data.hasOfficialToday) {
      this.goResult()
      return
    }
    this.startGenerate(false)
  },

  onRegenerate() {
    if (this.data.loading) return
    wx.showModal({
      title: '娱乐重抽',
      content: '娱乐模式不计入正式运势，确定重抽？',
      success: (res) => {
        if (res.confirm) this.startGenerate(true)
      },
    })
  },

  startGenerate(isEntertainment) {
    this.setData({ animating: true, loading: true })
    wx.vibrateShort({ type: 'medium' })

    setTimeout(() => {
      this.setData({ exploding: true })
      wx.vibrateShort({ type: 'heavy' })
    }, 1200)

    fortuneService.generateAndSave(isEntertainment)
      .then(() => {
        setTimeout(() => {
          this.setData({ animating: false, exploding: false, loading: false })
          if (!isEntertainment) this.setData({ hasOfficialToday: true })
          this.goResult()
        }, 2000)
      })
      .catch((err) => {
        this.setData({ animating: false, exploding: false, loading: false })
        wx.showToast({ title: err.message || '生成失败', icon: 'none' })
      })
  },

  goResult() {
    wx.navigateTo({ url: '/pages/result/result' })
  },
})