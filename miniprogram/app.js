const storage = require('./utils/storage.js')

App({
  globalData: {
    currentFortune: null,
    userInfo: null,
    userId: null,
  },

  onLaunch() {
    const userId = storage.getUserId()
    const userInfo = storage.getUserInfo()
    this.globalData.userId = userId
    this.globalData.userInfo = userInfo

    wx.login({
      success(res) {
        console.log('[login] code:', res.code)
      },
    })
  },

  setCurrentFortune(fortune) {
    this.globalData.currentFortune = fortune
  },

  getCurrentFortune() {
    return this.globalData.currentFortune
  },

  updateUserInfo(info) {
    this.globalData.userInfo = info
    storage.setUserInfo(info)
  },
})