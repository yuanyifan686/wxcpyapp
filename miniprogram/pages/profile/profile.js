const fortuneService = require('../../services/fortune.js')
const storage = require('../../utils/storage.js')

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    userInfo: {},
    profile: { badges: [], totalDraws: 0, maxScore: 0, avgScore: 0, ssrCount: 0, checkInStreak: 0, points: 0 },
    defaultAvatar: DEFAULT_AVATAR,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    const userInfo = getApp().globalData.userInfo || storage.getUserInfo()
    this.setData({ userInfo })
    this.loadProfile()
  },

  loadProfile() {
    const userId = getApp().globalData.userId
    fortuneService.getUserProfile(userId).then((profile) => {
      if (profile) {
        this.setData({ profile })
      }
    })
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    const userInfo = { ...this.data.userInfo, avatarUrl }
    this.setData({ userInfo })
    getApp().updateUserInfo(userInfo)
  },

  onNicknameChange(e) {
    const nickname = e.detail.value
    const userInfo = { ...this.data.userInfo, nickname }
    this.setData({ userInfo })
    getApp().updateUserInfo(userInfo)
  },

  onCheckIn() {
    const userId = getApp().globalData.userId
    wx.showLoading({ title: '签到中' })
    fortuneService.doCheckIn(userId).then((res) => {
      wx.hideLoading()
      if (res.success) {
        wx.showToast({ title: '连续' + res.streak + '天 · 积分' + res.points, icon: 'none' })
        this.loadProfile()
      } else {
        wx.showToast({ title: res.msg || '签到失败', icon: 'none', duration: 3000 })
      }
    })
  },
})