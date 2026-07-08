const { levelColor } = require('../../utils/animation.js')

Component({
  properties: {
    title: { type: String, value: '' },
    level: { type: String, value: '' },
    glow: { type: Boolean, value: true },
  },
  data: { color: '#6C63FF' },
  observers: {
    level(l) {
      this.setData({ color: levelColor(l) })
    },
  },
})