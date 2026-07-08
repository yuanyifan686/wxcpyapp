Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/home', text: '运势', iconType: 'fortune' },
      { pagePath: '/pages/history/history', text: '历史', iconType: 'history' },
      { pagePath: '/pages/ranking/ranking', text: '欧皇榜', iconType: 'rank' },
      { pagePath: '/pages/profile/profile', text: '我的', iconType: 'profile' },
    ],
  },

  methods: {
    onSwitch(e) {
      const index = e.currentTarget.dataset.index
      const path = this.data.list[index].pagePath
      wx.switchTab({ url: path })
    },
  },
})