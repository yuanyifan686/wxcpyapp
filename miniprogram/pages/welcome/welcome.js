const storage = require('../../utils/storage.js')

const AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber2',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber3',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber5',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber6',
]

Page({
  data: {
    nickname: '',
    avatarUrl: AVATARS[0],
    avatarIdx: 0,
    hint: '昵称仅用于本次访问的排行榜与运势展示',
    hintError: false,
  },

  onLoad() {
    storage.getUserId()
    const idx = Math.floor(Math.random() * AVATARS.length)
    this.setData({ avatarUrl: AVATARS[idx], avatarIdx: idx })
  },

  onNameInput(e) {
    this.setData({
      nickname: e.detail.value,
      hint: '昵称仅用于本次访问的排行榜与运势展示',
      hintError: false,
    })
  },

  onChangeAvatar() {
    const next = (this.data.avatarIdx + 1) % AVATARS.length
    this.setData({ avatarIdx: next, avatarUrl: AVATARS[next] })
  },

  onSubmit() {
    const result = storage.saveNickname(this.data.nickname, this.data.avatarUrl)
    if (!result.ok) {
      this.setData({ hint: result.msg, hintError: true })
      return
    }
    const app = getApp()
    app.globalData.userInfo = { nickname: result.nickname, avatarUrl: this.data.avatarUrl }
    wx.showToast({ title: '欢迎，' + result.nickname, icon: 'none' })
    wx.switchTab({ url: '/pages/home/home' })
  },
})