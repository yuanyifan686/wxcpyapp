const { animateNumber, scoreToStars, levelColor } = require('../../utils/animation.js')

const REVEAL_STEPS = 8
const REVEAL_INTERVAL = 130

Page({
  data: {
    fortune: null,
    displayScore: 0,
    starCount: 0,
    levelColor: '#6C63FF',
    nickname: '赛博旅人',
    reveal: 0,
    ssrFlash: false,
    particles: [],
  },

  onLoad() {
    const app = getApp()
    const fortune = app.getCurrentFortune()
    const userInfo = app.globalData.userInfo || {}
    if (!fortune) {
      wx.showToast({ title: '暂无运势数据', icon: 'none' })
      setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1500)
      return
    }

    const particles = []
    for (let i = 0; i < 24; i++) {
      particles.push({
        id: i,
        x: 20 + Math.random() * 60,
        y: 30 + Math.random() * 40,
        delay: Math.random() * 0.3,
      })
    }

    this.setData({
      fortune,
      starCount: scoreToStars(fortune.score),
      levelColor: levelColor(fortune.level),
      nickname: userInfo.nickname || '赛博旅人',
      particles,
    })

    this.startReveal()

    if (fortune.level === 'SSR') {
      setTimeout(() => {
        this.setData({ ssrFlash: true })
        wx.vibrateShort({ type: 'heavy' })
      }, 300)
      setTimeout(() => this.setData({ ssrFlash: false }), 1300)
    }

    setTimeout(() => {
      animateNumber(this, 'displayScore', 0, fortune.score, 1200)
    }, 200)
  },

  startReveal() {
    let step = 0
    const timer = setInterval(() => {
      step += 1
      this.setData({ reveal: step })
      if (step >= REVEAL_STEPS) clearInterval(timer)
    }, REVEAL_INTERVAL)
  },

  onSharePoster() {
    const poster = this.selectComponent('#poster')
    if (!poster) return
    wx.showLoading({ title: '生成海报中' })
    poster.generate()
      .then((path) => {
        wx.hideLoading()
        wx.previewImage({ urls: [path], current: path })
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '海报生成失败', icon: 'none' })
      })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  onShareAppMessage() {
    const f = this.data.fortune
    return {
      title: '今日幸运值 ' + (f ? f.score : '?') + '% | 今日赛博运势',
      path: '/pages/home/home',
    }
  },
})