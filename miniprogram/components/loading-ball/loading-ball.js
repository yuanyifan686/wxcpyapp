Component({
  properties: {
    hint: { type: String, value: '✨ 点击获取今日运势' },
    animating: { type: Boolean, value: false },
    exploding: { type: Boolean, value: false },
    level: { type: String, value: '' },
  },

  data: {
    particles: [],
  },

  lifetimes: {
    attached() {
      const particles = []
      for (let i = 0; i < 20; i++) {
        particles.push({
          id: i,
          x: Math.random() * 90 + 5,
          y: Math.random() * 90 + 5,
          delay: Math.random() * 2,
        })
      }
      this.setData({ particles })
    },
  },

  methods: {
    onTap() {
      if (!this.data.animating) {
        this.triggerEvent('tap')
      }
    },
  },
})